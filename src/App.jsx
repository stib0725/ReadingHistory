import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login'; // 先ほど作成したログインコンポーネント
import BookApp from './BookApp'; // 以前作成したメインの読書管理コンポーネント

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 初期起動時に現在のログイン状態を確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. ログイン・ログアウトなどの状態変化をリアルタイムで監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // クリーンアップ処理
    return () => subscription.unsubscribe();
  }, []);

  // セッション確認中のローディング表示
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div className="container">
      {!session ? (
        // ログインしていない場合
        <Login />
      ) : (
        // ログインしている場合
        <>
          <header style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '10px 20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #ddd'
          }}>
            <span>ようこそ、{session.user.email} さん</span>
            <button 
              onClick={() => supabase.auth.signOut()}
              style={{ padding: '5px 15px', cursor: 'pointer' }}
            >
              ログアウト
            </button>
          </header>
          
          <main style={{ padding: '20px' }}>
            {/* 以前作成した読書管理アプリのメイン機能をここに表示 */}
            <BookApp />
          </main>
        </>
      )}
    </div>
  );
}

export default App;