import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // --- フォームの状態管理 ---
  const [formData, setFormData] = useState({ 
    id: null, 
    title: '', author: '', publisher: '', published_date: '', 
    summary: '', review: '', read_date: new Date().toISOString().split('T')[0],
    finish_date: null, category: '小説', status: '積読', image_url: ''
  });

  // 1. statusesに「読りたい」を追加
  const categories = ['小説', '技術書', 'ビジネス書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['読みたい', '積読', '読書中', '読了'];

  // --- データの読み込み ---
  const fetchBooks = async () => {
    const { data, error } = await supabase.from('books').select('*').order('read_date', { ascending: false });
    if (!error) setBooks(data || []);
  };
  useEffect(() => { fetchBooks(); }, []);

  // --- フォームのリセット ---
  const resetForm = () => {
    setFormData({ id: null, title: '', author: '', publisher: '', published_date: '', summary: '', review: '', finish_date: null, read_date: new Date().toISOString().split('T')[0], category: '小説', status: '積読', image_url: '' });
  };

  // --- 一覧のリストをタップした時にフォームに情報をセット ---
  const handleEdit = (book) => {
    setFormData({
      id: book.id,
      title: book.title || '',
      author: book.author || '',
      publisher: book.publisher || '',
      published_date: book.published_date || '',
      summary: book.summary || '',
      review: book.review || '',
      read_date: book.read_date || new Date().toISOString().split('T')[0],
      finish_date: book.finish_date || null,
      category: book.category || '小説',
      status: book.status || '積読',
      image_url: book.image_url || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- 保存または更新の処理 ---
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    const { id, ...submitData } = formData; 

    if (id) {
      const { error } = await supabase.from('books').update(submitData).eq('id', id);
      if (!error) alert("更新しました！");
    } else {
      const { error } = await supabase.from('books').insert([submitData]);
      if (!error) alert("保存しました！");
    }

    resetForm();
    fetchBooks();
  };

  // --- バーコードスキャン機能 ---
  const startScan = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
          async (decodedText) => {
            await fetchBookInfo(decodedText);
            await html5QrCode.stop();
            setIsScanning(false);
          }, () => {}
        );
      } catch (e) { setIsScanning(false); }
    }, 100);
  };

  // --- 2. APIから本情報を取得 ＋ 重複チェック ---
  const fetchBookInfo = async (isbn) => {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await res.json();
      if (data.items) {
        const info = data.items[0].volumeInfo;
        const newTitle = info.title || '';

        // 【追加】すでに本棚にあるかチェック
        const isDuplicate = books.some(book => book.title === newTitle);

        if (isDuplicate) {
          const confirmInsert = window.confirm(`「${newTitle}」はすでに本棚にあります。もう一度登録しますか？`);
          if (!confirmInsert) {
            // キャンセルされた場合はフォームにセットだけして、保存はしない
            setFormData({ 
              ...formData, id: null, title: newTitle, 
              author: info.authors?.join(', ') || '不明', 
              image_url: info.imageLinks?.thumbnail || '' 
            });
            return; 
          }
        }

        // 重複していない、または「はい」を押した場合はフォームにセット
        setFormData({ 
          ...formData, id: null, title: newTitle, 
          author: info.authors?.join(', ') || '不明', 
          publisher: info.publisher || '不明', 
          published_date: info.publishedDate || '', 
          summary: info.description || '', 
          image_url: info.imageLinks?.thumbnail || '' 
        });
        
        alert(`「${newTitle}」の情報を取得しました。保存ボタンを押して完了してください。`);
      }
    } catch (e) { console.error(e); }
  };

  const deleteBook = async (id) => {
    if (window.confirm('削除しますか？')) {
      await supabase.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const styles = {
    container: { padding: '15px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' },
    form: { background: '#f9f9f9', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: formData.id ? '2px solid #007bff' : '1px solid #eee' },
    card: { display: 'flex', gap: '12px', padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', background: 'white' },
    statusBadge: (status) => ({
      fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold',
      background: status === '読了' ? '#e1f5fe' : status === '読書中' ? '#fff9c4' : status === '読みたい' ? '#f3e5f5' : '#eee',
      color: status === '読了' ? '#0288d1' : status === '読書中' ? '#fbc02d' : status === '読みたい' ? '#9c27b0' : '#666'
    })
  };

  return (
    <div style={styles.container}>
      <h2>📚 わたしの本棚</h2>
      
      {!isScanning ? (
        <button onClick={startScan} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>📷 バーコード登録</button>
      ) : (
        <div style={{ marginBottom: '15px' }}>
          <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
          <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '10px', marginTop: '10px', background: '#666', color: 'white', border: 'none', borderRadius: '8px' }}>中止</button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={{fontSize: '11px', color: '#007bff', marginBottom: '5px', fontWeight: 'bold'}}>{formData.id ? "● 編集モード" : "● 新規登録"}</div>
        <input style={{ width: '100%', padding: '10px', marginBottom: '8px', boxSizing: 'border-box' }} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <textarea style={{ width: '100%', padding: '10px', marginBottom: '8px', fontSize: '13px', boxSizing: 'border-box', minHeight: '60px' }} placeholder="感想をメモ..." value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select 
            style={{ flex: 1, padding: '10px' }} 
            value={formData.status} 
            onChange={e => {
              const newStatus = e.target.value;
              let newFinishDate = formData.finish_date;
              if (newStatus === '読了' && !newFinishDate) {
                newFinishDate = new Date().toISOString().split('T')[0];
              }
              setFormData({...formData, status: newStatus, finish_date: newFinishDate});
            }}
          >
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <button type="submit" style={{ flex: 1, background: formData.id ? '#28a745' : '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
            {formData.id ? "更新する" : "保存する"}
          </button>
        </div>

        {formData.id && (
          <button type="button" onClick={resetForm} style={{ width: '100%', padding: '8px', background: '#666', color: 'white', border: 'none', borderRadius: '5px' }}>
            編集をキャンセル
          </button>
        )}
      </form>

      <input style={{ width: '100%', padding: '12px', borderRadius: '25px', border: '1px solid #ddd', marginBottom: '15px', boxSizing: 'border-box' }} placeholder="本を検索..." onChange={e => setSearchTerm(e.target.value)} />

      <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden' }}>
        {filteredBooks.map(book => (
          <div key={book.id} style={styles.card} onClick={() => handleEdit(book)}>
            <img src={book.image_url || 'https://via.placeholder.com/60x85?text=No+Img'} style={{ width: '60px', height: '85px', objectFit: 'cover', borderRadius: '4px' }} alt="cover" />
            <div style={{ flex: 1 }}>
              <span style={styles.statusBadge(book.status)}>{book.status}</span>
              <div style={{ fontWeight: 'bold', fontSize: '15px', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{book.author}</div>
              {book.finish_date && book.status === '読了' && <div style={{ fontSize: '11px', color: '#2ecc71', marginTop: '2px' }}>🏁 {book.finish_date}</div>}
              {book.review && <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💭 {book.review}</div>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }} style={{ border: 'none', background: 'none', color: '#ccc', padding: '10px' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookApp;