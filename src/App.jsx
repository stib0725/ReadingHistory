import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Html5QrcodeScanner } from "html5-qrcode"; // インストールしたライブラリ

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false); // スキャン中かどうかの状態
  const [formData, setFormData] = useState({ 
    title: '', author: '', rating: 5, review: '', 
    read_date: new Date().toISOString().split('T')[0],
    category: '小説' 
  });

  const categories = ['小説', '技術書', 'ビジネス書', '漫画', '雑誌', 'その他'];

// --- 📷 バーコードスキャン機能 (Xperia対応版) ---
  const startScan = () => {
    setIsScanning(true);

    const scanner = new Html5QrcodeScanner(
      "reader", 
      { 
        fps: 10, 
        // qrbox をあえて外す（Xperiaの画面比率に合わせるため）
        // videoConstraints も一旦外してブラウザに選ばせる
      },
      false
    );

    scanner.render(async (isbn) => {
      console.log("ISBN取得:", isbn);
      try {
        await fetchBookInfo(isbn);
      } finally {
        scanner.clear().catch(e => console.error(e));
        setIsScanning(false);
      }
    }, (error) => {
      // エラーは無視
    });
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
          review: info.description ? info.description.substring(0, 100) + '...' : '' // 最初の方だけ引用
        });
        alert(`「${info.title}」の情報を取得しました！`);
      } else {
        alert("本が見つかりませんでした。ISBN番号が正しいか確認してください。");
      }
    } catch (err) {
      console.error("APIエラー:", err);
      alert("情報取得中にエラーが発生しました。");
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

      {/* バーコード読み取りエリア */}
      {!isScanning ? (
        <button onClick={startScan} style={styles.scanBtn}>📷 バーコードで本を登録</button>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <div id="reader" style={{ width: '100%' }}></div>
          <button onClick={() => window.location.reload()} style={{...styles.scanBtn, background: '#666'}}>キャンセル</button>
        </div>
      )}

      {/* 登録フォーム */}
      <form onSubmit={addBook} style={styles.form}>
        <input style={styles.input} placeholder="タイトル" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input style={styles.input} placeholder="著者名" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        <select style={styles.input} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea style={styles.input} placeholder="感想（自動取得されたあらすじ）" value={formData.review} onChange={e => setFormData({...formData, review: e.target.value})} />
        <button type="submit" style={styles.saveBtn}>この内容で保存</button>
      </form>

      {/* 検索・一覧 */}
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