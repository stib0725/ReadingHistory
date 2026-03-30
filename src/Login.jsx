import React, { useState } from 'react'; // React を明示的にインポート
import { supabase } from './supabaseClient';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("ログイン失敗: " + error.message);
    } else {
      // ログイン成功時は App.jsx 側の onAuthStateChange が検知して画面が切り替わります
      console.log('ログイン成功');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto', textAlign: 'center' }}>
      <h2 style={{ color: '#333' }}>BookApp ログイン</h2>
      <form onSubmit={handleLogin} style={{ textAlign: 'left', background: '#f9f9f9', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>メールアドレス:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="example@mail.com"
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>パスワード:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading} 
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px', 
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? '認証中...' : 'ログイン'}
        </button>
      </form>
      <p style={{ fontSize: '12px', color: '#888', marginTop: '15px' }}>
        ※アカウントがない場合はSupabase管理画面から作成してください
      </p>
    </div>
  );
};

export default Login;