import React, { useState, useEffect } from 'react'; // Reactを明示的にインポート
import { supabase } from './supabaseClient';
import Login from './Login';
import BookApp from './BookApp';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("App: 認証状態の確認を開始します...");

    // 1. 初期セッションの取得
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("App: セッション取得エラー:", error);
      }
      console.log("App: 現在のセッション:", session);
      setSession(session);
      setLoading(false); // ここで false にならないと画面が真っ白になります
    }).catch(err => {
      console.error("App: 予期せぬエラー:", err);
      setLoading(false);
    });

    // 2. 状態変化の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("App: 認証状態が変化しました:", _event, session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // コンソールでどこまで進んでいるか確認するためのログ
  console.log("App: レンダリング中 - loading:", loading, "session:", !!session);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>読み込み中...</h3>
        <p>もしこの画面から進まない場合は、SupabaseのURL設定を確認してください。</p>
      </div>
    );
  }

  return (
    <div className="container">
      {!session ? (
        <Login />
      ) : (
        <>
          <header style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '10px 20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #ddd'
          }}>
            <span style={{fontSize: '14px'}}>👤 {session.user.email}</span>
            <button 
              onClick={() => {
                console.log("App: ログアウトを実行します");
                supabase.auth.signOut();
              }}
              style={{ padding: '5px 15px', cursor: 'pointer' }}
            >
              ログアウト
            </button>
          </header>
          
          <main>
            <BookApp />
          </main>
        </>
      )}
    </div>
  );
}

export default App;