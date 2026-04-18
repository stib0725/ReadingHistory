import React, { useState, useEffect, useRef } from 'react';

// 本アプリ: Supabaseを使用した蔵書管理システム
// 修正内容: デプロイ環境でのSupabase初期化エラー（URL未定義）を回避するガード処理を追加

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

  // スクリプトの動的読み込み用ヘルパー
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        // Supabaseのロード
        if (!window.supabase) {
          await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
        }

        // Html5Qrcodeのロード
        if (!window.Html5Qrcode) {
          await loadScript("https://unpkg.com/html5-qrcode");
        }

        // 環境変数の取得（存在しない場合は既存のURLをデフォルトにする）
        // window.__SUPABASE_URL などが定義されていない場合を考慮
        const supabaseUrl = (typeof window !== 'undefined' && window.__SUPABASE_URL) 
          ? window.__SUPABASE_URL 
          : "";
          
        const supabaseAnonKey = (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY) 
          ? window.__SUPABASE_ANON_KEY 
          : "";
        
        if (window.supabase) {
          // URLとKeyが空でないことを確認してから作成
          if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('undefined')) {
            throw new Error("Supabaseの接続情報が正しく設定されていません。URLまたはKeyが不足しています。");
          }
          
          supabaseRef.current = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
          setDebugInfo('データベース接続完了');
        }
        setIsReady(true);
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorMsg("初期化に失敗しました: " + err.message);
      }
    };
    initApp();
  }, []);

  const fetchBooks = async () => {
    if (!supabaseRef.current) return;
    try {
      const { data, error } = await supabaseRef.current.from('books').select('*');
      if (error) throw error;
      if (data) setBooks(data);
    } catch (e) {
      setErrorMsg("データ取得に失敗しました。");
    }
  };

  useEffect(() => {
    if (isReady && supabaseRef.current) fetchBooks();
  }, [isReady]);

  const resetForm = () => {
    setFormData(initialFormState);
    setErrorMsg(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!supabaseRef.current) return;

    try {
      const { id, ...submitData } = formData; 
      if (submitData.status !== '読了') submitData.finish_date = null;

      let error;
      if (id) {
        const res = await supabaseRef.current.from('books').update(submitData).eq('id', id);
        error = res.error;
      } else {
        const res = await supabaseRef.current.from('books').insert([submitData]);
        error = res.error;
      }
      
      if (error) throw error;
      resetForm();
      fetchBooks();
      setDebugInfo('保存しました');
    } catch (err) {
      setErrorMsg(`保存エラー: ${err.message}`);
    }
  };

  const toggleFavorite = async (e, book) => {
    e.stopPropagation();
    if (!supabaseRef.current) return;
    try {
      await supabaseRef.current.from('books').update({ is_favorite: !book.is_favorite }).eq('id', book.id);
      fetchBooks();
    } catch (err) {}
  };

  const deleteBook = async (id) => {
    if (!supabaseRef.current) return;
    if (window.confirm('この本を削除しますか？')) {
      await supabaseRef.current.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  const startScan = async () => {
    if (!window.Html5Qrcode) {
      setDebugInfo('スキャナーを準備中...');
      try {
        await loadScript("https://unpkg.com/html5-qrcode");
      } catch (e) {
        setErrorMsg("スキャナーの読み込みに失敗しました。");
        return;
      }
    }

    setIsScanning(true);
    setErrorMsg(null);
    
    setTimeout(async () => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { 
            fps: 10, 
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            const code = decodedText.trim().replace(/-/g, '');
            if (code.startsWith('978') || code.startsWith('979')) {
              const isbn = code.substring(0, 13);
              await html5QrCode.stop().catch(() => {});
              setIsScanning(false);
              fetchBookInfo(isbn);
            }
          }, 
          () => {}
        ).catch(err => {
          setIsScanning(false);
          setErrorMsg("カメラの起動に失敗しました。HTTPS環境であることと、カメラ権限を確認してください。");
        });
      } catch (e) { 
        setIsScanning(false);
        setErrorMsg("スキャナーの初期化に失敗しました。");
      }
    }, 500);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchBookInfo = async (isbn) => {
    if (!isbn) return;
    
    const maxRetries = 3;
    let attempts = 0;
    let bookData = null;

    try {
      while (attempts < maxRetries && !bookData) {
        attempts++;
        setDebugInfo(`ISBN: ${isbn} を取得中... (${attempts}/${maxRetries})`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); 

          const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          
          const data = await response.json();
          
          if (data.items && data.items.length > 0) {
            const info = data.items[0].volumeInfo;
            bookData = {
              title: info.title || '',
              author: info.authors?.join(', ') || '不明',
              publisher: info.publisher || '不明',
              published_date: info.publishedDate || '',
              summary: info.description || '',
              image_url: info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:') : '',
            };
            break; 
          }
        } catch (err) {
          console.warn(`Attempt ${attempts} failed:`, err);
        }

        if (!bookData && attempts < maxRetries) {
          await sleep(1500);
        }
      }

      if (bookData) {
        setFormData(prev => ({ 
          ...prev, 
          ...bookData,
          id: null 
        }));
        setDebugInfo(`「${bookData.title}」を取得しました`);
      } else {
        setErrorMsg(`本が見つかりませんでした (ISBN: ${isbn})。手動入力してください。`);
        setDebugInfo('取得失敗');
      }
    } catch (error) {
      setErrorMsg("通信エラーが発生しました。");
      setDebugInfo('エラー発生');
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
      let comp = 0;
      const desc = sortOrder === 'desc';
      if (sortBy === 'finish_date') {
        const da = a.finish_date ? new Date(a.finish_date).getTime() : 0;
        const db = b.finish_date ? new Date(b.finish_date).getTime() : 0;
        comp = desc ? db - da : da - db;
      } else if (sortBy === 'created_at') {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        comp = desc ? tb - ta : ta - tb;
      } else {
        comp = (a.title || "").localeCompare(b.title || "", 'ja');
        if (desc) comp *= -1;
      }
      return comp;
    });
    return result;
  };

  const filteredBooks = getFilteredAndSortedBooks();

  const styles = {
    container: { padding: '15px', maxWidth: '500px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh', color: '#333' },
    form: { background: '#fff', padding: '15px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
    input: { width: '100%', padding: '12px', marginBottom: '10px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' },
    select: { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', background: '#fff' },
    textarea: { width: '100%', padding: '12px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #ddd', minHeight: '70px', outline: 'none' },
    tabScroll: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none', marginBottom: '8px' },
    pill: (active, color) => ({
      padding: '6px 12px', borderRadius: '20px', border: 'none', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? color : '#f0f0f0', color: active ? 'white' : '#666', fontWeight: active ? 'bold' : 'normal'
    }),
    card: { display: 'flex', gap: '15px', padding: '15px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: 'white', position: 'relative' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(3px)' },
    modalContent: { background: 'white', padding: '20px', borderRadius: '20px', maxWidth: '420px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }
  };

  return (
    <div style={styles.container}>
      <h2 style={{margin: '0 0 15px 0', fontSize: '20px', textAlign: 'center'}}>My Library</h2>
      
      <div style={{fontSize: '10px', color: '#999', marginBottom: '10px', textAlign: 'center'}}>{debugInfo}</div>

      {errorMsg && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '10px', borderRadius: '10px', marginBottom: '15px', fontSize: '12px', border: '1px solid #ffcccc' }}>
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{float:'right', border:'none', background:'none', color:'#d32f2f', cursor:'pointer'}}>✕</button>
        </div>
      )}

      {!isScanning ? (
        <button onClick={startScan} style={{ width: '100%', padding: '14px', marginBottom: '20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
          📷 バーコードをスキャン
        </button>
      ) : (
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <div id="reader" style={{ width: '100%', minHeight: '250px', borderRadius: '16px', overflow: 'hidden', background: '#000' }}></div>
          <button onClick={() => { setIsScanning(false); }} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', zIndex: 10 }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.input} placeholder="本タイトル *" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.input} placeholder="著者" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        
        <div style={{display: 'flex', gap: '10px'}}>
          <div style={{flex:1}}>
            <label style={{fontSize: '11px', color: '#999', marginLeft: '5px'}}>カテゴリ</label>
            <select style={styles.select} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize: '11px', color: '#999', marginLeft: '5px'}}>ステータス</label>
            <select style={styles.select} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {formData.status === '読了' && (
          <input type="date" style={styles.input} value={formData.finish_date || ''} onChange={e => setFormData({...formData, finish_date: e.target.value})} />
        )}
        
        <textarea style={styles.textarea} placeholder="感想・メモ" value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        
        <button type="submit" style={{ width: '100%', padding: '14px', background: '#007bff', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          {formData.id ? "更新する" : "本棚に追加"}
        </button>
        {formData.id && (
          <button type="button" onClick={resetForm} style={{width:'100%', marginTop:'10px', background:'none', border:'none', color:'#666', textDecoration:'underline'}}>キャンセル</button>
        )}
      </form>

      {/* 絞り込み/並び替え */}
      <div style={{ marginBottom: '20px', padding: '12px', background: '#fff', borderRadius: '16px', border: '1px solid #eee' }}>
        <input style={{ width: '100%', padding: '10px', borderRadius: '20px', border: '1px solid #f0f0f0', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', fontSize: '13px' }} placeholder="本棚から検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        
        <div style={styles.tabScroll}>
          {['すべて', '★', ...statuses].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={styles.pill(statusFilter === s, s === '★' ? '#f1c40f' : '#333')}>{s}</button>
          ))}
        </div>

        <div style={styles.tabScroll}>
          {['すべて', ...categories].map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={styles.pill(categoryFilter === c, '#007bff')}>{c}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '5px', alignItems: 'center' }}>
          <select style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #f0f0f0', fontSize: '11px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="finish_date">読了日順</option>
            <option value="created_at">登録順</option>
            <option value="title">タイトル順</option>
          </select>
          <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #f0f0f0', background: 'white', fontSize: '11px' }}>
            {sortOrder === 'asc' ? '昇順 ↑' : '降順 ↓'}
          </button>
          <div style={{fontSize: '12px', color: '#666', fontWeight: 'bold', minWidth: '40px', textAlign: 'right'}}>{filteredBooks.length}冊</div>
        </div>
      </div>

      <div style={{borderRadius: '16px', overflow: 'hidden', background: '#fff', border: '1px solid #f0f0f0'}}>
        {filteredBooks.map(book => (
          <div key={book.id} style={styles.card} onClick={() => { setFormData({...book, finish_date: book.finish_date || ''}); window.scrollTo({top:0, behavior:'smooth'}); }}>
            <img 
              src={book.image_url || 'https://via.placeholder.com/60x85?text=No+Image'} 
              style={{ width: '60px', height: '85px', objectFit: 'cover', borderRadius: '6px' }} 
              alt={book.title} 
              onClick={(e) => { e.stopPropagation(); setSelectedBook(book); }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '4px'}}>
                <span style={{fontSize: '9px', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', marginRight: '4px', background: '#eee'}}>{book.status}</span>
                <span style={{fontSize: '9px', padding: '1px 6px', borderRadius: '4px', color: 'white', background: '#007bff'}}>{book.category}</span>
                <span onClick={(e) => toggleFavorite(e, book)} style={{fontSize: '20px', cursor: 'pointer', color: book.is_favorite ? '#f1c40f' : '#eee', marginLeft: 'auto'}}>
                  {book.is_favorite ? '★' : '☆'}
                </span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: 'auto' }}>{book.author}</div>
              {book.status === '読了' && book.finish_date && (
                <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>読了: {book.finish_date}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedBook && (
        <div style={styles.modalOverlay} onClick={() => setSelectedBook(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '15px'}}>
              <img src={selectedBook.image_url || 'https://via.placeholder.com/120x170?text=No+Image'} style={{ width: '120px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} alt={selectedBook.title} />
            </div>
            <h3 style={{margin: '0 0 10px 0', fontSize: '16px', lineHeight: '1.4'}}>{selectedBook.title}</h3>
            <div style={{fontSize: '13px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
              <p style={{margin: '0 0 6px 0'}}><strong>著者:</strong> {selectedBook.author}</p>
              <p style={{margin: '0 0 6px 0'}}><strong>出版社:</strong> {selectedBook.publisher || '不明'}</p>
              <p style={{margin: '0 0 6px 0'}}><strong>出版日:</strong> {selectedBook.published_date || '不明'}</p>
              <p style={{margin: '0 0 15px 0'}}><strong>ステータス:</strong> {selectedBook.status} ({selectedBook.category})</p>
              
              <div style={{marginBottom: '15px'}}>
                <p style={{fontWeight: 'bold', margin: '0 0 4px 0', color: '#666', fontSize: '12px'}}>あらすじ</p>
                <div style={{fontSize: '12px', color: '#666', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '8px', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto'}}>{selectedBook.summary || 'なし'}</div>
              </div>
              
              <div>
                <p style={{fontWeight: 'bold', margin: '0 0 4px 0', color: '#666', fontSize: '12px'}}>メモ</p>
                <div style={{fontSize: '12px', color: '#333', backgroundColor: '#fffbe6', padding: '10px', borderRadius: '8px', border: '1px solid #fff1b8'}}>{selectedBook.review || 'なし'}</div>
              </div>
            </div>
            <button onClick={() => setSelectedBook(null)} style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;