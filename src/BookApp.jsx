import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [categoryFilter, setCategoryFilter] = useState('すべて');
  const [sortBy, setSortBy] = useState('read_date_desc');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const [formData, setFormData] = useState({ 
    id: null, title: '', author: '', publisher: '', published_date: '', 
    summary: '', review: '', read_date: new Date().toISOString().split('T')[0],
    finish_date: '', category: '小説', status: '積読', image_url: ''
  });

  const categories = ['小説', '技術書', 'ビジネス書', '実用書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['読みたい', '積読', '読書中', '読了'];

  // カテゴリーごとの色定義
  const getCategoryColor = (category) => {
    const colors = {
      '小説': '#007bff', '技術書': '#fd7e14', 'ビジネス書': '#28a745', 
      '漫画': '#e83e8c', '実用書': '#20c997', '雑誌': '#6f42c1', 
      '新書': '#17a2b8', 'その他': '#6c757d'
    };
    return colors[category] || '#6c757d';
  };

  const fetchBooks = async () => {
    const { data, error } = await supabase.from('books').select('*');
    if (!error) setBooks(data || []);
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const resetForm = () => {
    setFormData({ id: null, title: '', author: '', publisher: '', published_date: '', summary: '', review: '', finish_date: '', read_date: new Date().toISOString().split('T')[0], category: '小説', status: '積読', image_url: '' });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("ログインが必要です");

    const { id, ...submitData } = formData; 
    if (submitData.finish_date === '') submitData.finish_date = null;

    if (id) {
      await supabase.from('books').update(submitData).eq('id', id).eq('user_id', user.id);
    } else {
      await supabase.from('books').insert([{ ...submitData, user_id: user.id }]);
    }
    resetForm();
    fetchBooks();
  };

  const deleteBook = async (id) => {
    if (window.confirm('削除しますか？')) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('books').delete().eq('id', id).eq('user_id', user.id);
      fetchBooks();
    }
  };

  const getFilteredAndSortedBooks = () => {
    let result = [...books];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(b => (b.title?.toLowerCase().includes(term)) || (b.author?.toLowerCase().includes(term)));
    }
    if (statusFilter !== 'すべて') result = result.filter(b => b.status === statusFilter);
    if (categoryFilter !== 'すべて') result = result.filter(b => b.category === categoryFilter);

    result.sort((a, b) => {
      if (sortBy === 'read_date_desc') return new Date(b.read_date || 0) - new Date(a.read_date || 0);
      if (sortBy === 'read_date_asc') return new Date(a.read_date || 0) - new Date(b.read_date || 0);
      if (sortBy === 'title_asc') return (a.title || "").localeCompare(b.title || "", 'ja');
      return 0;
    });
    return result;
  };

  const filteredBooks = getFilteredAndSortedBooks();

  const startScan = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
          async (decodedText) => {
            await html5QrCode.stop().catch(() => {});
            setIsScanning(false);
            fetchBookInfo(decodedText);
          }, () => {}
        );
      } catch (e) { setIsScanning(false); }
    }, 100);
  };

  const fetchBookInfo = async (isbn) => {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await res.json();
    if (data.items) {
      const info = data.items[0].volumeInfo;
      setFormData({ 
        ...formData, id: null, title: info.title || '', author: info.authors?.join(', ') || '不明', 
        publisher: info.publisher || '不明', published_date: info.publishedDate || '', 
        summary: info.description || '', image_url: info.imageLinks?.thumbnail || '',
        category: '小説'
      });
    }
  };

  const styles = {
    container: { padding: '15px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh' },
    form: { background: '#f1f3f5', padding: '15px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
    inputField: { width: '100%', padding: '10px', marginBottom: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' },
    textareaField: { width: '100%', padding: '12px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', minHeight: '120px', lineHeight: '1.5', resize: 'vertical' },
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
      background: getCategoryColor(cat)
    }),
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: 'white', padding: '25px', borderRadius: '15px', maxWidth: '400px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }
  };

  return (
    <div style={styles.container}>
      <h2 style={{textAlign: 'center', color: '#333'}}>My Library</h2>
      
      {!isScanning ? (
        <button onClick={startScan} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>📷 スキャンして追加</button>
      ) : (
        <div id="reader" style={{ width: '100%', minHeight: '300px', marginBottom: '15px' }}></div>
      )}

      {/* 登録・編集フォーム */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.inputField} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        
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
            <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>読了日:</label>
            <input type="date" style={styles.inputField} value={formData.finish_date || ''} onChange={e => setFormData({...formData, finish_date: e.target.value})} />
          </div>
        )}
        
        <textarea 
          style={styles.textareaField} 
          placeholder="感想やメモを残しましょう！" 
          value={formData.review} 
          onChange={e => setFormData({...formData, review: e.target.value})} 
        />
        
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
          {formData.id ? "更新する" : "保存する"}
        </button>
        {formData.id && <button type="button" onClick={resetForm} style={{width:'100%', marginTop:'10px', fontSize:'12px', background:'none', border:'none', color:'#888', textDecoration:'underline'}}>新規登録に戻る</button>}
      </form>

      {/* 検索・絞り込みセクション（カテゴリー復活！） */}
      <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input style={{ width: '100%', padding: '12px', borderRadius: '25px', border: '1px solid #ddd', boxSizing: 'border-box' }} placeholder="タイトル・著者検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        
        {/* ステータス絞り込み */}
        <div style={styles.tabScroll}>
          {['すべて', ...statuses].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={styles.statusTab(statusFilter === s, '#007bff')}>{s}</button>
          ))}
        </div>

        {/* カテゴリー絞り込み（復活） */}
        <div style={styles.tabScroll}>
          {['すべて', ...categories].map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={styles.statusTab(categoryFilter === c, '#6c757d')}>{c}</button>
          ))}
        </div>

        <select style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #eee', fontSize: '12px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="read_date_desc">登録が新しい順</option>
          <option value="read_date_asc">登録が古い順</option>
          <option value="title_asc">タイトル順</option>
        </select>
      </div>

      {/* 本の一覧 */}
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
              <div style={{display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px'}}>
                <span style={styles.badge(book.status)}>{book.status}</span>
                <span style={styles.categoryBadge(book.category)}>{book.category}</span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{book.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{book.author}</div>
              {book.status === '読了' && book.finish_date && (
                <div style={{ fontSize: '11px', color: '#28a745', marginTop: '4px' }}>🏁 {book.finish_date} 読了</div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }} style={{ position: 'absolute', right: '10px', top: '10px', border: 'none', background: 'none', color: '#ccc' }}>✕</button>
          </div>
        ))}
      </div>

      {/* 詳細モーダル（リッチ表示に復元！） */}
      {selectedBook && (
        <div style={styles.modalOverlay} onClick={() => setSelectedBook(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{textAlign: 'center', marginBottom: '20px'}}>
              <img src={selectedBook.image_url || 'https://via.placeholder.com/120x170'} style={{ width: '120px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} alt="cover" />
            </div>
            <h3 style={{margin: '0 0 12px 0', fontSize: '1.2rem'}}>{selectedBook.title}</h3>
            
            <div style={{fontSize: '13px', lineHeight: '1.8', color: '#444'}}>
              <p><strong>著者:</strong> {selectedBook.author}</p>
              <p><strong>出版社:</strong> {selectedBook.publisher || '不明'}</p>
              <p><strong>出版日:</strong> {selectedBook.published_date || '不明'}</p>
              <p><strong>カテゴリー:</strong> {selectedBook.category}</p>
              
              <div style={{borderTop: '1px solid #eee', marginTop: '15px', paddingTop: '15px'}}>
                <p style={{color: '#666', marginBottom: '5px'}}><strong>あらすじ:</strong></p>
                <p style={{fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap'}}>{selectedBook.summary || 'データなし'}</p>
              </div>
            </div>
            
            <button onClick={() => setSelectedBook(null)} style={{ width: '100%', marginTop: '25px', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookApp;