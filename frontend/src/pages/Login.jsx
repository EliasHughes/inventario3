import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const clean = (s) => (s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = clean(email).toLowerCase();
    const cleanPassword = (password || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Ingrese correo y contraseña');
      return;
    }
    setLoading(true);
    try {
      await login(cleanEmail, cleanPassword);
      toast.success('Inicio de sesión exitoso');
      navigate('/');
    } catch (err) {
      // Diagnóstico detallado
      let msg;
      const response = err?.response;
      if (!response) {
        msg = err?.message
          ? `Error de red: ${err.message}`
          : 'No se pudo contactar al servidor. Revise su conexión.';
      } else {
        const detail = response.data?.detail;
        if (typeof detail === 'string') msg = detail;
        else if (Array.isArray(detail)) msg = detail.map((d) => d?.msg || JSON.stringify(d)).join(' · ');
        else if (detail?.msg) msg = detail.msg;
        else msg = `Error ${response.status}: ${response.statusText || 'sin detalle'}`;
      }
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-white font-black text-2xl">CI</div>
          <h2 className="mt-6 text-3xl font-bold">Iniciar Sesión</h2>
          <p className="text-gray-600 mt-2">Sistema de Gestión de Activos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
          <div>
            <label className="block text-sm font-medium mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="tu@email.com"
              data-testid="login-email-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              data-testid="login-password-input"
            />
          </div>

          {errorMsg && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800" data-testid="login-error-msg">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
            data-testid="login-submit-btn"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
