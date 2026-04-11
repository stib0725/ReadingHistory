import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

// 注意: 通常のnpm開発環境では import { createClient } from '@supabase/supabase-js' を使用します。
// ここでは、現在のCDN読み込み構成を維持しつつ、環境変数に対応する書き換え例を示します。

const App = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [categoryFilter, setCategoryFilter] = useState('すべて');
  
  const [sortBy, setSortBy] = useState('finish_date');
  const [sortOrder, setSortOrder] = useState('desc');

  const [isScanning, setIsScanning] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  
  const supabaseRef = useRef(null);

  const [formData, setFormData] = useState({ 
    id: null, title: '', author: '', publisher: '', published_date: '', 
    summary: '', review: '', read_date: new Date().toISOString().split('T')[0],
    finish_date: '', category: '小説', status: '積読', image_url: '',
    is_favorite: false 
  });

  const categories = ['小説', '技術書', 'ビジネス書', '実用書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['読みたい', '積読', '読書中', '読了'];

  useEffect(() => {
    const loadScripts = async () => {
      try {
        if (!window.supabase) {
          const supabaseScript = document.createElement('script');
          supabaseScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          supabaseScript.async = true;
          document.body.appendChild(supabaseScript);
          await new Promise((resolve) => { supabaseScript.onload = resolve; });
        }

        if (!window.Html5Qrcode) {
          const qrScript = document.createElement('script');
          qrScript.src = "https://unpkg.com/html5-qrcode";
          qrScript.async = true;
          document.body.appendChild(qrScript);
          await new Promise((resolve) => { qrScript.onload = resolve; });
        }

        // 環境変数の取得（Vite / CRA 両対応）
        const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || window.__SUPABASE_URL; 
        const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY; 
        
        if (supabaseUrl && supabaseAnonKey && window.supabase) {
          supabaseRef.current = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
          setDebugInfo('Supabase初期化完了');
        } else {
          setDebugInfo('接続情報未設定');
        }

        setIsReady(true);
      } catch (err) {
        setErrorMsg("ライブラリ読み込み失敗: " + err.message);
      }
    };

    loadScripts();
  }, []);

  const fetchBooks = async () => {
    if (!supabaseRef.current) return;
    try {
      setDebugInfo('データ取得中...');
      const { data, error } = await supabaseRef.current
        .from('books')
        .select('*');
      
      if (error) throw error;
      
      if (data) {
        setBooks(data);
        setDebugInfo(`取得成功: ${data.length} 件`);
      }
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg(`データ取得エラー: ${e.message}`);
      setDebugInfo('取得失敗');
    }
  };

  useEffect(() => {
    if (isReady && supabaseRef.current) {
      fetchBooks();
    }
  }, [isReady]);

  const resetForm = () => {
    setFormData({ 
      id: null, title: '', author: '', publisher: '', published_date: '', 
      summary: '', review: '', finish_date: '', 
      read_date: new Date().toISOString().split('T')[0], 
      category: '小説', status: '積読', image_url: '', is_favorite: false 
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!supabaseRef.current) return;

    try {
      setDebugInfo('保存処理中...');
      const { id, ...submitData } = formData; 
      delete submitData.user_id; 

      if (submitData.finish_date === '') submitData.finish_date = null;

      let error;
      if (id) {
        const res = await supabaseRef.current.from('books').update(submitData).eq('id', id);
        error = res.error;
      } else {
        const res = await supabaseRef.current.from('books').insert([submitData]);
        error = res.error;
      }
      
      if (error) throw error;

      setDebugInfo('保存成功！');
      resetForm();
      fetchBooks();
    } catch (err) {
      setErrorMsg(`保存エラー: ${err.message}`);
      setDebugInfo('保存失敗');
    }
  };

  const toggleFavorite = async (e, book) => {
    e.stopPropagation();
    if (!supabaseRef.current) return;
    try {
      const { error } = await supabaseRef.current
        .from('books')
        .update({ is_favorite: !book.is_favorite })
        .eq('id', book.id);
      if (error) throw error;
      fetchBooks();
    } catch (err) {
      setErrorMsg(`お気に入り更新エラー: ${err.message}`);
    }
  };

  const deleteBook = async (id) => {
    if (!supabaseRef.current) return;
    if (window.confirm('この本を削除してもよろしいですか？')) {
      const { error } = await supabaseRef.current.from('books').delete().eq('id', id);
      if (error) setErrorMsg(`削除エラー: ${error.message}`);
      fetchBooks();
    }
  };

  const startScan = async () => {
    if (!window.Html5Qrcode) return;
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (decodedText) => {
            await html5QrCode.stop().catch(() => {});
            setIsScanning(false);
            fetchBookInfo(decodedText);
          }, 
          () => {}
        );
      } catch (e) { 
        setIsScanning(false); 
      }
    }, 300);
  };

  const fetchBookInfo = async (isbn) => {
    try {
      setDebugInfo('Google Books APIから情報取得中...');
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const info = data.items[0].volumeInfo;
        setFormData(prev => ({ 
          ...prev, 
          id: null, 
          title: info.title || '', 
          author: info.authors?.join(', ') || '不明', 
          publisher: info.publisher || '不明', 
          published_date: info.publishedDate || '', 
          summary: info.description || '', 
          image_url: info.imageLinks?.thumbnail || '',
        }));
        setDebugInfo('書籍情報取得成功');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setDebugInfo('書籍情報が見つかりませんでした');
      }
    } catch (error) {
      setDebugInfo('書籍情報取得失敗');
    }
  };

  const getFilteredAndSortedBooks = () => {
    let result = [...books];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(b => (b.title?.toLowerCase().includes(term)) || (b.author?.toLowerCase().includes(term)));
    }
    if (statusFilter === '★') {
      result = result.filter(b => b.is_favorite);
    } else if (statusFilter !== 'すべて') {
      result = result.filter(b => b.status === statusFilter);
    }
    if (categoryFilter !== 'すべて') result = result.filter(b => b.category === categoryFilter);

    result.sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      let comparison = 0;
      const isDesc = sortOrder === 'desc';
      switch (sortBy) {
        case 'finish_date': {
          const dateA = a.finish_date ? new Date(a.finish_date).getTime() : null;
          const dateB = b.finish_date ? new Date(b.finish_date).getTime() : null;
          if (dateA === null && dateB === null) comparison = 0;
          else if (dateA === null) return 1;
          else if (dateB === null) return -1;
          else comparison = isDesc ? dateB - dateA : dateA - dateB;
          break;
        }
        case 'created_at': {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          comparison = isDesc ? timeB - timeA : timeA - timeB;
          break;
        }
        case 'title': {
          comparison = (a.title || "").localeCompare(b.title || "", 'ja');
          if (isDesc) comparison *= -1;
          break;
        }
        default:
          comparison = 0;
      }
      if (comparison === 0) return (a.title || "").localeCompare(b.title || "", 'ja');
      return comparison;
    });
    return result;
  };

  const styles = {
    container: { padding: '15px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh' },
    form: { background: '#f1f3f5', padding: '15px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
    inputField: { width: '100%', padding: '10px', marginBottom: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' },
    textareaField: { width: '100%', padding: '12px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', minHeight: '100px', lineHeight: '1.5', resize: 'vertical' },
    tabScroll: { display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none', marginBottom: '5px' },
    statusTab: (active, color) => ({
      padding: '6px 12px', borderRadius: '15px', border: 'none', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? color : '#eee', color: active ? 'white' : '#666', fontWeight: active ? 'bold' : 'normal'
    }),
    card: { display: 'flex', gap: '12px', padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', background: 'white', position: 'relative' },
    badge: (s) => ({
      fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold', marginRight: '4px',
      background: s === '読了' ? '#e1f5fe' : s === '読書中' ? '#fff9c4' : s === '読みたい' ? '#f3e5f5' : '#eee',
      color: s === '読了' ? '#0288d1' : s === '読書中' ? '#fbc02d' : s === '読みたい' ? '#9c27b0' : '#666'
    }),
    categoryBadge: (cat) => ({
      fontSize: '10px', padding: '2px 8px', borderRadius: '10px', color: 'white', fontWeight: 'bold',
      background: {
        '小説': '#007bff', '技術書': '#fd7e14', 'ビジネス書': '#28a745', 
        '漫画': '#e83e8c', '実用書': '#20c997', '雑誌': '#6f42c1', 
        '新書': '#17a2b8', 'その他': '#6c757d'
      }[cat] || '#6c757d'
    }),
    favButton: (isFav) => ({ fontSize: '20px', cursor: 'pointer', color: isFav ? '#f1c40f' : '#ddd', marginLeft: 'auto' }),
    orderButton: (active) => ({
      flex: 1, padding: '8px 4px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
      background: active ? '#333' : 'white', color: active ? 'white' : '#666', fontWeight: active ? 'bold' : 'normal',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
    }),
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: 'white', padding: '25px', borderRadius: '15px', maxWidth: '400px', width: '100%', maxHeight: '85vh', overflowY: 'auto' },
    countDisplay: { fontSize: '13px', color: '#555', padding: '5px 12px', backgroundColor: '#f0f4f8', borderRadius: '20px', display: 'inline-block', fontWeight: 'bold', border: '1px solid #d1d9e6' }
  };

  const filteredBooks = getFilteredAndSortedBooks();

  return (
    <div style={styles.container}>
      <h2 style={{textAlign: 'center', color: '#333'}}>My Library</h2>
      <div style={{fontSize: '10px', color: '#888', marginBottom: '10px', textAlign: 'center', backgroundColor: '#eee', padding: '4px', borderRadius: '4px'}}>ログ: {debugInfo}</div>
      {errorMsg && <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '12px', border: '1px solid #ffcccc' }}><strong>Error:</strong> {errorMsg}<button onClick={() => setErrorMsg(null)} style={{float:'right', border:'none', background:'none', color:'#d32f2f'}}>✕</button></div>}
      
      {!isScanning ? (
        <button onClick={startScan} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', opacity: isReady ? 1 : 0.5 }} disabled={!isReady}>
          {isReady ? '📷 ISBNスキャンして追加' : '読み込み中...'}
        </button>
      ) : (
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <div id="reader" style={{ width: '100%', minHeight: '250px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}></div>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', zIndex: 10 }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.inputField} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.inputField} placeholder="著者" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select style={{flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc'}} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={{flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc'}} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {formData.status === '読了' && (
          <div style={{marginBottom: '8px'}}>
            <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>🏁 読了日:</label>
            <input type="date" style={styles.inputField} value={formData.finish_date || ''} onChange={e => setFormData({...formData, finish_date: e.target.value})} />
          </div>
        )}
        <textarea style={styles.textareaField} placeholder="感想やメモを残しましょう！" value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
          {formData.id ? "更新する" : "保存する"}
        </button>
        {formData.id && (
          <button type="button" onClick={resetForm} style={{width:'100%', marginTop:'10px', fontSize:'12px', background:'none', border:'none', color:'#888', textDecoration:'underline'}}>新規登録に戻る</button>
        )}
      </form>

      <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input style={{ width: '100%', padding: '12px', borderRadius: '25px', border: '1px solid #ddd', boxSizing: 'border-box' }} placeholder="タイトル・著者検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8f9fa', padding: '10px', borderRadius: '12px'}}>
          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <select style={{flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px'}} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="finish_date">読了日</option>
              <option value="created_at">登録日</option>
              <option value="title">タイトル</option>
            </select>
            <div style={{display: 'flex', gap: '4px', flex: 1}}>
              <button type="button" onClick={() => setSortOrder('asc')} style={styles.orderButton(sortOrder === 'asc')}>昇順 ↑</button>
              <button type="button" onClick={() => setSortOrder('desc')} style={styles.orderButton(sortOrder === 'desc')}>降順 ↓</button>
            </div>
          </div>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={styles.tabScroll}>
            {['すべて', '★', ...statuses].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={styles.statusTab(statusFilter === s, s === '★' ? '#f1c40f' : '#007bff')}>{s}</button>
            ))}
          </div>
          <div style={{...styles.countDisplay, marginLeft: '10px'}}>{filteredBooks.length} 冊</div>
        </div>
        <div style={styles.tabScroll}>
          {['すべて', ...categories].map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={styles.statusTab(categoryFilter === c, '#6c757d')}>{c}</button>
          ))}
        </div>
      </div>

      <div>
        {filteredBooks.map(book => (
          <div key={book.id} style={styles.card} onClick={() => { setFormData({...book, finish_date: book.finish_date || ''}); window.scrollTo({top:0, behavior:'smooth'}); }}>
            <img 
              src={book.image_url || 'https://via.placeholder.com/60x85'} 
              style={{ width: '60px', height: '85px', objectFit: 'cover', borderRadius: '4px' }} 
              alt="cover" 
              onClick={(e) => { e.stopPropagation(); setSelectedBook(book); }}
            />
            <div style={{ flex: 1 }}>
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '2px'}}>
                <span style={styles.badge(book.status)}>{book.status}</span>
                <span style={styles.categoryBadge(book.category)}>{book.category}</span>
                <span 
                  onClick={(e) => toggleFavorite(e, book)} 
                  style={styles.favButton(book.is_favorite)}
                >
                  {book.is_favorite ? '★' : '☆'}
                </span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{book.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{book.author}</div>
              {book.finish_date && (
                <div style={{ fontSize: '11px', color: '#2c3e50', marginTop: '6px', backgroundColor: '#eef2f7', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                  🏁 <span style={{fontWeight: 'bold'}}>{book.finish_date}</span> 読破！
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }} style={{ position: 'absolute', right: '10px', bottom: '10px', border: 'none', background: 'none', color: '#eee', fontSize: '10px' }}>削除</button>
          </div>
        ))}
      </div>

      {selectedBook && (
        <div style={styles.modalOverlay} onClick={() => setSelectedBook(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{textAlign: 'center', marginBottom: '20px'}}>
              <img src={selectedBook.image_url || 'https://via.placeholder.com/120x170'} style={{ width: '120px', borderRadius: '8px' }} alt="cover" />
            </div>
            <h3 style={{margin: '0 0 12px 0'}}>{selectedBook.title}</h3>
            <div style={{fontSize: '14px', lineHeight: '1.8'}}>
              <p><strong>著者:</strong> {selectedBook.author}</p>
              <p><strong>出版社:</strong> {selectedBook.publisher || '不明'}</p>
              <p><strong>出版日:</strong> {selectedBook.published_date || '不明'}</p>
              <p><strong>あらすじ:</strong></p>
              <div style={{fontSize: '13px', color: '#444', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '8px'}}>
                {selectedBook.summary || 'なし'}
              </div>
            </div>
            <button onClick={() => setSelectedBook(null)} style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;