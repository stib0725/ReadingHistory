import React, { useState, useEffect, useRef } from 'react';

// 本アプリ: Supabaseを使用した蔵書管理システム
// 接続エラー対策: 環境変数の代わりに直接指定またはwindowオブジェクトを確認

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

  const initialFormState = { 
    id: null, title: '', author: '', publisher: '', published_date: '', 
    summary: '', review: '', read_date: new Date().toISOString().split('T')[0],
    finish_date: '', category: '小説', status: '積読', image_url: '',
    is_favorite: false 
  };

  const [formData, setFormData] = useState(initialFormState);

  const categories = ['小説', '技術書', 'ビジネス書', '実用書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['読みたい', '積読', '読書中', '読了'];

  useEffect(() => {
    const loadScripts = async () => {
      try {
        // 1. Supabase ライブラリの読み込み
        if (!window.supabase) {
          const supabaseScript = document.createElement('script');
          supabaseScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          supabaseScript.async = true;
          document.body.appendChild(supabaseScript);
          await new Promise((resolve) => { supabaseScript.onload = resolve; });
        }

        // 2. バーコードスキャンライブラリの読み込み
        if (!window.Html5Qrcode) {
          const qrScript = document.createElement('script');
          qrScript.src = "https://unpkg.com/html5-qrcode";
          qrScript.async = true;
          document.body.appendChild(qrScript);
          await new Promise((resolve) => { qrScript.onload = resolve; });
        }

        // 3. Supabase 接続情報の取得
        // 【重要】Canvas環境では .env が使えないため、こちらに直接入力するか window オブジェクト経由にする必要があります
        const supabaseUrl = window.__SUPABASE_URL || ""; // ここに直接 "https://xxx.supabase.co" と書いても動作します
        const supabaseAnonKey = window.__SUPABASE_ANON_KEY || ""; // ここに直接 Anon Key を書いても動作します
        
        if (supabaseUrl && supabaseAnonKey && window.supabase) {
          supabaseRef.current = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
          setDebugInfo('Supabase接続成功');
        } else {
          setDebugInfo('Supabase設定待ち...');
          setErrorMsg("SupabaseのURLまたはAPIキーが設定されていません。コード内の supabaseUrl / supabaseAnonKey を確認してください。");
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
      const { data, error } = await supabaseRef.current
        .from('books')
        .select('*');
      
      if (error) throw error;
      if (data) setBooks(data);
    } catch (e) {
      console.error("Fetch error:", e.message);
      setErrorMsg("データの取得に失敗しました。テーブル名 'books' が存在するか確認してください。");
    }
  };

  useEffect(() => {
    if (isReady && supabaseRef.current) {
      fetchBooks();
    }
  }, [isReady]);

  const resetForm = () => {
    setFormData(initialFormState);
    setErrorMsg(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!supabaseRef.current) {
      setErrorMsg("Supabaseに接続されていないため保存できません。");
      return;
    }

    try {
      setDebugInfo('保存中...');
      const { id, ...submitData } = formData; 
      
      // 認証ユーザーがいる場合は user_id をセット
      const { data: authData } = await supabaseRef.current.auth.getUser();
      if (authData?.user) {
        submitData.user_id = authData.user.id;
      }

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

      setDebugInfo('保存完了');
      resetForm();
      fetchBooks();
    } catch (err) {
      setErrorMsg(`保存エラー: ${err.message}`);
    }
  };

  const toggleFavorite = async (e, book) => {
    e.stopPropagation();
    if (!supabaseRef.current) return;
    try {
      await supabaseRef.current
        .from('books')
        .update({ is_favorite: !book.is_favorite })
        .eq('id', book.id);
      fetchBooks();
    } catch (err) {
      setErrorMsg(`更新エラー: ${err.message}`);
    }
  };

  const deleteBook = async (id) => {
    if (!supabaseRef.current) return;
    if (window.confirm('この本を削除しますか？')) {
      await supabaseRef.current.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  const startScan = async () => {
    if (!window.Html5Qrcode) return;
    setIsScanning(true);
    setDebugInfo('カメラ起動中...');
    setErrorMsg(null);

    setTimeout(async () => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 15, qrbox: { width: 250, height: 150 } },
          async (decodedText) => {
            const cleanedIsbn = decodedText.replace(/\D/g, '');
            if (cleanedIsbn.length >= 10) {
              await html5QrCode.stop().catch(() => {});
              setIsScanning(false);
              fetchBookInfo(cleanedIsbn);
            }
          }, 
          () => {}
        );
      } catch (e) { 
        setIsScanning(false);
        setErrorMsg("カメラの起動に失敗しました。");
      }
    }, 300);
  };

  const fetchBookInfo = async (isbn) => {
    if (!isbn) return;
    try {
      setDebugInfo(`ISBN: ${isbn} 検索中...`);
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
          image_url: info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:') : '',
        }));
        setDebugInfo('書籍情報を取得しました');
      } else {
        setDebugInfo('書籍が見つかりませんでした');
      }
    } catch (error) {
      setDebugInfo('API通信エラー');
    }
  };

  const promptIsbn = () => {
    const val = window.prompt("ISBN番号（13桁）を入力してください");
    if (val) fetchBookInfo(val.replace(/\D/g, ''));
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
          const dateA = a.finish_date ? new Date(a.finish_date).getTime() : 0;
          const dateB = b.finish_date ? new Date(b.finish_date).getTime() : 0;
          comparison = isDesc ? dateB - dateA : dateA - dateB;
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
        default: comparison = 0;
      }
      return comparison || (a.title || "").localeCompare(b.title || "", 'ja');
    });
    return result;
  };

  const styles = {
    container: { padding: '15px', maxWidth: '500px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh' },
    form: { background: '#f1f3f5', padding: '15px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
    inputField: { width: '100%', padding: '12px', marginBottom: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' },
    textareaField: { width: '100%', padding: '12px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px', resize: 'vertical' },
    tabScroll: { display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none', marginBottom: '5px' },
    statusTab: (active, color) => ({
      padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? color : '#eee', color: active ? 'white' : '#666', fontWeight: active ? 'bold' : 'normal'
    }),
    card: { display: 'flex', gap: '12px', padding: '15px', borderBottom: '1px solid #eee', cursor: 'pointer', background: 'white', position: 'relative' },
    badge: (s) => ({
      fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', marginRight: '4px',
      background: s === '読了' ? '#e1f5fe' : s === '読書中' ? '#fff9c4' : s === '読みたい' ? '#f3e5f5' : '#eee',
      color: s === '読了' ? '#0288d1' : s === '読書中' ? '#fbc02d' : s === '読みたい' ? '#9c27b0' : '#666'
    }),
    categoryBadge: (cat) => ({
      fontSize: '10px', padding: '2px 8px', borderRadius: '12px', color: 'white', fontWeight: 'bold',
      background: {
        '小説': '#007bff', '技術書': '#fd7e14', 'ビジネス書': '#28a745', 
        '漫画': '#e83e8c', '実用書': '#20c997', '雑誌': '#6f42c1', 
        '新書': '#17a2b8', 'その他': '#6c757d'
      }[cat] || '#6c757d'
    }),
    favButton: (isFav) => ({ fontSize: '22px', cursor: 'pointer', color: isFav ? '#f1c40f' : '#ddd', marginLeft: 'auto', lineHeight: '1' }),
    orderButton: (active) => ({
      flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
      background: active ? '#333' : 'white', color: active ? 'white' : '#666'
    }),
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: 'white', padding: '25px', borderRadius: '16px', maxWidth: '400px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }
  };

  const filteredBooks = getFilteredAndSortedBooks();

  return (
    <div style={styles.container}>
      <h2 style={{textAlign: 'center', color: '#333', letterSpacing: '1px'}}>My Library</h2>
      
      <div style={{fontSize: '11px', color: '#777', marginBottom: '12px', textAlign: 'center', backgroundColor: '#f0f0f0', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
        <span>{debugInfo}</span>
        <button onClick={promptIsbn} style={{border: 'none', background: '#ccc', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer'}}>番号入力</button>
      </div>

      {errorMsg && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', border: '1px solid #ffcccc' }}>
          <strong>お知らせ:</strong> {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{float:'right', border:'none', background:'none', color:'#d32f2f', cursor: 'pointer'}}>✕</button>
        </div>
      )}

      {!isScanning ? (
        <button 
          onClick={startScan} 
          style={{ width: '100%', padding: '14px', marginBottom: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 6px rgba(40,167,69,0.2)' }}
        >
          📷 バーコードをスキャン
        </button>
      ) : (
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <div id="reader" style={{ width: '100%', minHeight: '250px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}></div>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', zIndex: 10, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.inputField} placeholder="本タイトル *" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.inputField} placeholder="著者" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select style={{flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white'}} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={{flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white'}} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {formData.status === '読了' && (
          <div style={{marginBottom: '10px'}}>
            <label style={{fontSize: '12px', color: '#555', marginLeft: '4px', display: 'block', marginBottom: '4px'}}>🏁 読了日:</label>
            <input type="date" style={styles.inputField} value={formData.finish_date || ''} onChange={e => setFormData({...formData, finish_date: e.target.value})} />
          </div>
        )}
        
        <textarea style={styles.textareaField} placeholder="感想・メモ" value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        
        <button type="submit" style={{ width: '100%', padding: '14px', background: '#007bff', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px' }}>
          {formData.id ? "情報を更新" : "本棚に追加"}
        </button>
        {formData.id && (
          <button type="button" onClick={resetForm} style={{width:'100%', marginTop:'12px', fontSize:'13px', background:'none', border:'none', color:'#666', textDecoration:'underline', cursor: 'pointer'}}>キャンセルして新規登録</button>
        )}
      </form>

      <div style={{ marginBottom: '20px' }}>
        <input style={{ width: '100%', padding: '14px', borderRadius: '25px', border: '1px solid #ddd', boxSizing: 'border-box', marginBottom: '12px', fontSize: '14px' }} placeholder="キーワード検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        
        <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
          <select style={{flex: 1.2, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '13px'}} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="finish_date">読了日順</option>
            <option value="created_at">登録日順</option>
            <option value="title">タイトル順</option>
          </select>
          <div style={{display: 'flex', gap: '4px', flex: 1}}>
            <button type="button" onClick={() => setSortOrder('asc')} style={styles.orderButton(sortOrder === 'asc')}>昇順</button>
            <button type="button" onClick={() => setSortOrder('desc')} style={styles.orderButton(sortOrder === 'desc')}>降順</button>
          </div>
        </div>

        <div style={styles.tabScroll}>
          {['すべて', '★', ...statuses].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={styles.statusTab(statusFilter === s, s === '★' ? '#f1c40f' : '#333')}>{s}</button>
          ))}
        </div>
      </div>

      <div>
        {filteredBooks.map(book => (
          <div key={book.id} style={styles.card} onClick={() => { setFormData({...book, finish_date: book.finish_date || ''}); window.scrollTo({top:0, behavior:'smooth'}); }}>
            <img 
              src={book.image_url || 'https://via.placeholder.com/65x95?text=No+Image'} 
              style={{ width: '65px', height: '95px', objectFit: 'cover', borderRadius: '6px', backgroundColor: '#eee' }} 
              alt={book.title} 
              onClick={(e) => { e.stopPropagation(); setSelectedBook(book); }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '4px'}}>
                <span style={styles.badge(book.status)}>{book.status}</span>
                <span style={styles.categoryBadge(book.category)}>{book.category}</span>
                <span onClick={(e) => toggleFavorite(e, book)} style={styles.favButton(book.is_favorite)}>
                  {book.is_favorite ? '★' : '☆'}
                </span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
              <div style={{ fontSize: '13px', color: '#666' }}>{book.author}</div>
            </div>
          </div>
        ))}
      </div>

      {selectedBook && (
        <div style={styles.modalOverlay} onClick={() => setSelectedBook(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{textAlign: 'center', marginBottom: '20px'}}>
              <img src={selectedBook.image_url || 'https://via.placeholder.com/130x180?text=No+Image'} style={{ width: '130px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }} alt={selectedBook.title} />
            </div>
            <h3 style={{margin: '0 0 15px 0', fontSize: '18px', lineHeight: '1.4'}}>{selectedBook.title}</h3>
            <div style={{fontSize: '14px', lineHeight: '1.7', color: '#333'}}>
              <p><strong>著者:</strong> {selectedBook.author}</p>
              <p><strong>あらすじ:</strong></p>
              <div style={{fontSize: '13px', color: '#555', backgroundColor: '#f0f4f8', padding: '12px', borderRadius: '10px', marginBottom: '15px'}}>
                {selectedBook.summary || '情報なし'}
              </div>
              <p><strong>メモ:</strong></p>
              <div style={{fontSize: '13px', color: '#333', backgroundColor: '#fff9db', padding: '12px', borderRadius: '10px'}}>
                {selectedBook.review || 'メモなし'}
              </div>
            </div>
            <button onClick={() => setSelectedBook(null)} style={{ width: '100%', marginTop: '25px', padding: '14px', background: '#333', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;