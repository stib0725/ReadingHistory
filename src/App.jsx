import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [sortBy, setSortBy] = useState('read_date_desc');
  const [isScanning, setIsScanning] = useState(false);
  
  // 詳細表示用の状態
  const [selectedBook, setSelectedBook] = useState(null);

  const [formData, setFormData] = useState({ 
    id: null, title: '', author: '', publisher: '', published_date: '', 
    summary: '', review: '', read_date: new Date().toISOString().split('T')[0],
    finish_date: null, category: '小説', status: '積読', image_url: ''
  });

  const categories = ['小説', '技術書', 'ビジネス書', '実用書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['読みたい', '積読', '読書中', '読了'];

  const fetchBooks = async () => {
    const { data, error } = await supabase.from('books').select('*');
    if (!error) setBooks(data || []);
  };
  useEffect(() => { fetchBooks(); }, []);

  const resetForm = () => {
    setFormData({ id: null, title: '', author: '', publisher: '', published_date: '', summary: '', review: '', finish_date: null, read_date: new Date().toISOString().split('T')[0], category: '小説', status: '積読', image_url: '' });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const { id, ...submitData } = formData; 
    if (id) {
      await supabase.from('books').update(submitData).eq('id', id);
    } else {
      await supabase.from('books').insert([submitData]);
    }
    resetForm();
    fetchBooks();
  };

  const deleteBook = async (id) => {
    if (window.confirm('削除しますか？')) {
      await supabase.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  // 🔍 フィルタリング & ソートロジック
  const getFilteredAndSortedBooks = () => {
    let result = [...books];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(b => 
        (b.title?.toLowerCase().includes(term)) || 
        (b.author?.toLowerCase().includes(term)) ||
        (b.category?.toLowerCase().includes(term))
      );
    }
    if (statusFilter !== 'すべて') {
      result = result.filter(b => b.status === statusFilter);
    }
    result.sort((a, b) => {
      if (sortBy === 'read_date_desc') return new Date(b.read_date) - new Date(a.read_date);
      if (sortBy === 'read_date_asc') return new Date(a.read_date) - new Date(b.read_date);
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title, 'ja');
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
      const isDuplicate = books.some(book => book.title === info.title);
      if (isDuplicate && !window.confirm(`「${info.title}」は登録済みです。再度登録しますか？`)) return;
      
      setFormData({ 
        ...formData, id: null, title: info.title || '', author: info.authors?.join(', ') || '不明', 
        publisher: info.publisher || '不明', published_date: info.publishedDate || '', 
        summary: info.description || '', image_url: info.imageLinks?.thumbnail || '',
        category: 'その他'
      });
    }
  };

  const styles = {
    container: { padding: '15px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh' },
    form: { background: '#f1f3f5', padding: '15px', borderRadius: '12px', marginBottom: '20px' },
    label: { fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' },
    statusTab: (active) => ({
      padding: '6px 12px', borderRadius: '15px', border: 'none', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? '#007bff' : '#eee', color: active ? 'white' : '#666', fontWeight: active ? 'bold' : 'normal'
    }),
    card: { display: 'flex', gap: '12px', padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', background: 'white', position: 'relative' },
    badge: (s) => ({
      fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold', marginRight: '4px',
      background: s === '読了' ? '#e1f5fe' : s === '読書中' ? '#fff9c4' : s === '読みたい' ? '#f3e5f5' : '#eee',
      color: s === '読了' ? '#0288d1' : s === '読書中' ? '#fbc02d' : s === '読みたい' ? '#9c27b0' : '#666'
    }),
    // モーダル用スタイル
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: 'white', padding: '20px', borderRadius: '15px', maxWidth: '400px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }
  };

  return (
    <div style={styles.container}>
      <h2 style={{textAlign: 'center', color: '#333'}}>My Library</h2>
      
      {!isScanning ? (
        <button onClick={startScan} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>📷 スキャンして追加</button>
      ) : (
        <div id="reader" style={{ width: '100%', minHeight: '300px', marginBottom: '15px' }}></div>
      )}

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={{fontSize: '11px', color: '#007bff', marginBottom: '5px', fontWeight: 'bold'}}>{formData.id ? "● 編集モード" : "● 新規登録"}</div>
        <input style={{ width: '100%', padding: '10px', marginBottom: '8px', boxSizing: 'border-box' }} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{flex: 1}}><select style={{width: '100%', padding: '10px'}} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{flex: 1}}><select style={{width: '100%', padding: '10px'}} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <textarea style={{ width: '100%', padding: '10px', marginBottom: '8px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="感想..." value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>{formData.id ? "更新する" : "保存する"}</button>
        {formData.id && <button type="button" onClick={resetForm} style={{width:'100%', marginTop:'8px', fontSize:'12px', background:'none', border:'none', color:'#888', textDecoration:'underline'}}>新規登録に戻る</button>}
      </form>

      {/* 🔍 検索・ソート */}
      <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input style={{ width: '100%', padding: '12px', borderRadius: '25px', border: '1px solid #ddd', boxSizing: 'border-box' }} placeholder="タイトル・著者名で検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
          {['すべて', ...statuses].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={styles.statusTab(statusFilter === s)}>{s}</button>
          ))}
        </div>
        <select style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #eee', fontSize: '12px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="read_date_desc">登録が新しい順</option>
          <option value="read_date_asc">登録が古い順</option>
          <option value="title_asc">タイトル順</option>
        </select>
      </div>

      {/* 一覧表示 */}
      <div style={{ background: 'white', borderRadius: '10px' }}>
        {filteredBooks.map(book => (
          <div key={book.id} style={styles.card} onClick={() => { setFormData({...book}); window.scrollTo({top:0, behavior:'smooth'}); }}>
            {/* アイコンをタップするとモーダルを表示 */}
            <img 
              src={book.image_url || 'https://via.placeholder.com/60x85'} 
              style={{ width: '60px', height: '85px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }} 
              alt="cover" 
              onClick={(e) => { e.stopPropagation(); setSelectedBook(book); }}
            />
            <div style={{ flex: 1 }}>
              <span style={styles.badge(book.status)}>{book.status}</span>
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>{book.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{book.author}</div>
              {book.status === '読了' && book.finish_date && <div style={{ fontSize: '11px', color: '#2ecc71', marginTop: '3px' }}>🏁 {book.finish_date}</div>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }} style={{ position: 'absolute', right: '10px', top: '10px', border: 'none', background: 'none', color: '#ccc' }}>✕</button>
          </div>
        ))}
      </div>

      {/* 詳細モーダル */}
      {selectedBook && (
        <div style={styles.modalOverlay} onClick={() => setSelectedBook(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{textAlign: 'center', marginBottom: '15px'}}>
              <img src={selectedBook.image_url || 'https://via.placeholder.com/120x170'} style={{ width: '120px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }} alt="cover" />
            </div>
            <h3 style={{margin: '0 0 10px 0', fontSize: '18px'}}>{selectedBook.title}</h3>
            <div style={{fontSize: '13px', color: '#666', marginBottom: '10px'}}>
              <p><strong>著者:</strong> {selectedBook.author}</p>
              <p><strong>出版社:</strong> {selectedBook.publisher || '不明'}</p>
              <p><strong>出版日:</strong> {selectedBook.published_date || '不明'}</p>
              <p><strong>カテゴリー:</strong> {selectedBook.category}</p>
            </div>
            <div style={{borderTop: '1px solid #eee', paddingTop: '10px'}}>
              <p style={{fontSize: '12px', color: '#333', lineHeight: '1.6'}}><strong>あらすじ:</strong><br />{selectedBook.summary || 'データなし'}</p>
            </div>
            <button 
              onClick={() => setSelectedBook(null)} 
              style={{ width: '100%', marginTop: '20px', padding: '10px', background: '#333', color: 'white', border: 'none', borderRadius: '8px' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookApp;