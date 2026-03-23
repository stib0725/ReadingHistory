import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
// --- 初期状態の更新 ---
const [formData, setFormData] = useState({ 
  title: '', 
  author: '', 
  publisher: '', // ← 追加
  published_date: '', // ← 追加
  rating: 5, 
  review: '', 
  read_date: new Date().toISOString().split('T')[0],
  category: '小説',
  status: '積読' 
});

// --- API取得関数の更新 ---
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
        publisher: info.publisher || '不明', // ← 出版社を取得
        published_date: info.publishedDate || '', // ← 出版日を取得
        category: info.categories ? info.categories[0] : 'その他',
        review: info.description ? info.description.substring(0, 100) + '...' : ''
      });
      alert(`「${info.title}」の情報を取得しました！`);
    }
  } catch (err) {
    console.error("APIエラー:", err);
  }
};

  const categories = ['小説', '技術書', 'ビジネス書', '漫画', '雑誌', '新書', 'その他'];
  const statuses = ['積読', '読書中', '読了'];

  // --- 📷 バーコードスキャン機能 ---
  const startScan = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const readerElement = document.getElementById("reader");
        if (!readerElement) {
          console.error("reader要素がまだありません");
          setIsScanning(false);
          return;
        }
        const html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            console.log("スキャン成功:", decodedText);
            try {
              await fetchBookInfo(decodedText);
            } finally {
              await html5QrCode.stop();
              setIsScanning(false);
            }
          },
          () => {}
        ).catch(err => {
          alert("カメラ開始エラー: " + err);
          setIsScanning(false);
        });
      } catch (globalErr) {
        console.error("重大なエラー:", globalErr);
        setIsScanning(false);
      }
    }, 100);
  };

  // --- 🌐 Google Books API から情報を取得 ---
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
          category: info.categories ? info.categories[0] : 'その他',
          review: info.description ? info.description.substring(0, 100) + '...' : ''
        });
        alert(`「${info.title}」の情報を取得しました！`);
      } else {
        alert("本が見つかりませんでした。");
      }
    } catch (err) {
      console.error("APIエラー:", err);
    }
  };

  // --- 既存の関数（データの読み込み・保存・削除） ---
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
        title: '', 
        author: '', 
        rating: 5, 
        review: '', 
        read_date: new Date().toISOString().split('T')[0], 
        category: '小説',
        status: '積読' 
      });
      fetchBooks();
    } else {
      console.error("保存エラー:", error);
      alert("保存に失敗しました。Supabaseのカラム名が 'status' になっているか確認してください。");
    }
  };

  const deleteBook = async (id) => {
    if (window.confirm('削除しますか？')) {
      await supabase.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const styles = {
    container: { padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' },
    form: { display: 'flex', flexDirection: 'column', gap: '10px', background: '#f0f4f8', padding: '20px', borderRadius: '12px', marginBottom: '20px' },
    input: { padding: '10px', borderRadius: '6px', border: '1px solid #ccc' },
    scanBtn: { padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' },
    saveBtn: { padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <h1>📚 読書ログ管理</h1>

      {!isScanning ? (
        <button onClick={startScan} style={styles.scanBtn}>📷 バーコードで本を登録</button>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <div id="reader" style={{ width: '100%', minHeight: '300px', backgroundColor: '#eee' }}></div>
          <button onClick={() => window.location.reload()} style={{...styles.scanBtn, background: '#666', marginTop: '10px', width: '100%'}}>スキャンを中止</button>
        </div>
      )}

      <form onSubmit={addBook} style={styles.form}>
        <input style={styles.input} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.input} placeholder="著者名" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        
        <label style={{fontSize: '0.8rem', color: '#666'}}>カテゴリ</label>
        <select style={styles.input} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        
        <textarea style={styles.input} placeholder="感想・あらすじ" value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        
        <label style={{fontSize: '0.8rem', color: '#666'}}>読書ステータス</label>
        <select 
          style={styles.input} 
          value={formData.status} 
          onChange={e => setFormData({...formData, status: e.target.value})}
        >
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button type="submit" style={styles.saveBtn}>この内容で保存</button>
      </form>

      <input 
        style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '20px', borderRadius: '20px', border: '1px solid #ddd' }}
        placeholder="本を検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
      />
    {filteredBooks.map(book => (
      <div key={book.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0', position: 'relative' }}>
        <h4>{book.title}</h4>
        <p style={{ fontSize: '0.8rem', color: '#666', margin: '4px 0' }}>
          {book.author} / {book.publisher} ({book.published_date})
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.7rem', color: '#999' }}>{book.category}</span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.7rem',
            background: book.status === '読了' ? '#e1f5fe' : book.status === '読書中' ? '#fff9c4' : '#f5f5f5',
            color: '#333'
          }}>
            {book.status || '積読'}
          </span>
        </div>
        {/* 削除ボタンなどはそのまま */}
      </div>
    ))}
    </div>
  );
};

export default BookApp;