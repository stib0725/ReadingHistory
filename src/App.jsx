import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5Qrcode } from "html5-qrcode";

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({ 
    title: '', author: '', rating: 5, review: '', 
    read_date: new Date().toISOString().split('T')[0],
    category: '小説' 
  });

  const categories = ['小説', '技術書', 'ビジネス書', '漫画', '雑誌', '新書', 'その他'];

// --- 📷 バーコードスキャン機能 (PC/スマホ共通・エラー診断付き) ---
  const startScan = async () => {
    setIsScanning(true);
    
    try {
      // 1. 要素の確認
      const readerElement = document.getElementById("reader");
      if (!readerElement) {
        alert("エラー: ID 'reader' の要素が見つかりません。");
        setIsScanning(false);
        return;
      }
      readerElement.innerHTML = "";

      // 2. インスタンス作成
      const html5QrCode = new Html5Qrcode("reader");

      // 3. 起動 (ID指定をせず、条件だけを渡すのが最も安定します)
      await html5QrCode.start(
        { facingMode: "environment" }, // 背面カメラを優先。PCなら標準カメラ。
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // 成功時
          console.log("スキャン成功:", decodedText);
          try {
            await fetchBookInfo(decodedText);
          } finally {
            await html5QrCode.stop();
            setIsScanning(false);
          }
        },
        (errorMessage) => {
          // スキャン中のエラー（読み取り失敗など）は無視
        }
      ).catch(err => {
        // ここでエラーを捕まえる
        alert("カメラ開始エラー: " + err);
        setIsScanning(false);
      });

    } catch (globalErr) {
      console.error("重大なエラー:", globalErr);
      alert("プログラム実行エラー: " + globalErr.message);
      setIsScanning(false);
    }
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
      setFormData({ title: '', author: '', rating: 5, review: '', read_date: new Date().toISOString().split('T')[0], category: '小説' });
      fetchBooks();
    }
  };

  const deleteBook = async (id) => {
    if (window.confirm('削除しますか？')) {
      await supabase.from('books').delete().eq('id', id);
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- スタイル ---
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
          {/* readerの高さを確保する */}
          <div id="reader" style={{ width: '100%', minHeight: '300px', backgroundColor: '#eee' }}></div>
          <button onClick={() => window.location.reload()} style={{...styles.scanBtn, background: '#666', marginTop: '10px', width: '100%'}}>スキャンを中止</button>
        </div>
      )}

      <form onSubmit={addBook} style={styles.form}>
        <input style={styles.input} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.input} placeholder="著者名" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        <select style={styles.input} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea style={styles.input} placeholder="感想・あらすじ" value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        <button type="submit" style={styles.saveBtn}>この内容で保存</button>
      </form>

      <input 
        style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '20px', borderRadius: '20px', border: '1px solid #ddd' }}
        placeholder="本を検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
      />

      {filteredBooks.map(book => (
        <div key={book.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0', position: 'relative' }}>
          <h4>{book.title}</h4>
          <p style={{ fontSize: '0.8rem', color: '#666' }}>{book.author} / {book.category}</p>
          <button onClick={() => deleteBook(book.id)} style={{ position: 'absolute', right: '0', top: '10px', color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>削除</button>
        </div>
      ))}
    </div>
  );
};

export default BookApp;