import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
  // --- 1. 状態管理 (新しいカラムを追加) ---
  const [formData, setFormData] = useState({ 
    title: '', 
    author: '', 
    publisher: '', 
    published_date: '', 
    summary: '',      // あらすじ
    review: '',       // 感想
    read_date: new Date().toISOString().split('T')[0], // 登録日
    finish_date: '',  // 読了日
    category: '小説',
    status: '積読' 
  });

  const categories = ['小説', '技術書', 'ビジネス書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['積読', '読書中', '読了'];

  // --- 2. 📷 バーコードスキャン機能 ---
  const startScan = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const readerElement = document.getElementById("reader");
        if (!readerElement) return;
        const html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            try {
              await fetchBookInfo(decodedText);
            } finally {
              await html5QrCode.stop();
              setIsScanning(false);
            }
          },
          () => {}
        ).catch(err => { alert(err); setIsScanning(false); });
      } catch (e) { setIsScanning(false); }
    }, 100);
  };

  // --- 3. 🌐 APIから取得 (summaryにあらすじを入れる) ---
  const fetchBookInfo = async (isbn) => {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const info = data.items[0].volumeInfo;
        setFormData({
          ...formData,
          title: info.title || '',
          author: info.authors ? info.authors.join(', ') : '不明',
          publisher: info.publisher || '不明', 
          published_date: info.publishedDate || '',
          category: info.categories ? info.categories[0] : 'その他',
          summary: info.description || '', // ここにあらすじ
          review: '' // 感想は空にしておく
        });
        alert(`「${info.title}」を取得しました！`);
      }
    } catch (err) { console.error(err); }
  };

  // --- 4. データの読み書き ---
  const fetchBooks = async () => {
    const { data, error } = await supabase.from('books').select('*').order('read_date', { ascending: false });
    if (!error) setBooks(data || []);
  };

  useEffect(() => { fetchBooks(); }, []);

  const addBook = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('books').insert([formData]);
    if (!error) {
      setFormData({ 
        title: '', author: '', publisher: '', published_date: '', 
        summary: '', review: '', finish_date: '',
        read_date: new Date().toISOString().split('T')[0], 
        category: '小説', status: '積読' 
      });
      fetchBooks();
    } else {
      alert(`保存エラー内容: ${error.message}\nカラム: ${error.details}`);
    }
  };

  const deleteBook = async (id) => {
    if (window.confirm('削除しますか？')) {
      await supabase.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- 5. スタイル ---
  const styles = {
    container: { padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' },
    form: { display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #e0e0e0' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#666', marginTop: '5px' },
    saveBtn: { padding: '15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    bookCard: { background: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', position: 'relative' },
    reviewBox: { background: '#fff9c4', padding: '10px', borderRadius: '5px', marginTop: '10px', fontSize: '14px' }
  };

  return (
    <div style={styles.container}>
      <h1>📚 読書ログ管理</h1>

      {!isScanning ? (
        <button onClick={startScan} style={{...styles.saveBtn, background: '#4CAF50', width: '100%', marginBottom: '20px'}}>📷 バーコードで登録</button>
      ) : (
        <div id="reader" style={{ width: '100%', minHeight: '300px', marginBottom: '20px' }}></div>
      )}

      <form onSubmit={addBook} style={styles.form}>
        <input style={styles.input} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.input} placeholder="著者名" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        
        <div style={{display: 'flex', gap: '10px'}}>
          <input style={{...styles.input, flex: 1}} placeholder="出版社" value={formData.publisher} onChange={e => setFormData({...formData, publisher: e.target.value})} />
          <input style={{...styles.input, flex: 1}} placeholder="出版日" value={formData.published_date} onChange={e => setFormData({...formData, published_date: e.target.value})} />
        </div>

        <label style={styles.label}>あらすじ</label>
        <textarea style={{...styles.input, minHeight: '80px'}} value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} />

        <label style={styles.label}>自分の感想</label>
        <textarea style={{...styles.input, minHeight: '80px'}} placeholder="感じたことをメモ..." value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />

        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <div style={{flex: 1}}>
            <label style={styles.label}>読了日</label>
            <input type="date" style={{...styles.input, width: '100%'}} value={formData.finish_date} onChange={e => setFormData({...formData, finish_date: e.target.value})} />
          </div>
          <div style={{flex: 1}}>
            <label style={styles.label}>ステータス</label>
            <select style={{...styles.input, width: '100%'}} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" style={styles.saveBtn}>本棚に保存する</button>
      </form>

      <input style={{...styles.input, width: '100%', borderRadius: '25px', marginBottom: '20px'}} placeholder="本を検索..." onChange={e => setSearchTerm(e.target.value)} />

      {filteredBooks.map(book => (
        <div key={book.id} style={styles.bookCard}>
          <h3 style={{margin: '0 0 5px 0'}}>{book.title}</h3>
          <p style={{fontSize: '0.85rem', color: '#666'}}>{book.author} / {book.publisher}</p>
          
          {book.finish_date && <p style={{fontSize: '0.8rem', color: '#2ecc71', fontWeight: 'bold'}}>🏁 {book.finish_date} 読了</p>}
          
          {book.review && (
            <div style={styles.reviewBox}>
              <strong>My Review:</strong>
              <p style={{margin: '5px 0'}}>{book.review}</p>
            </div>
          )}

          <div style={{marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '0.75rem', background: '#eee', padding: '3px 8px', borderRadius: '5px'}}>{book.category}</span>
            <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: book.status === '読了' ? '#007bff' : '#f39c12'}}>{book.status}</span>
          </div>
          
          <button onClick={() => deleteBook(book.id)} style={{position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'none', color: '#ccc', cursor: 'pointer'}}>✖</button>
        </div>
      ))}
    </div>
  );
};

export default BookApp;