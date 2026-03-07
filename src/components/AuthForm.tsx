import { useState } from 'react';
import { Zap, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthForm() {
  const { signUp, signIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(formData.email, formData.password, formData.username);
      } else {
        await signIn(formData.email, formData.password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-12 h-12 text-[#CEFF00]" fill="#CEFF00" />
            <h1 className="text-4xl font-bold text-[#CEFF00] uppercase tracking-wider">
              Checkpoint
            </h1>
          </div>
          <p className="text-slate-400 text-sm uppercase tracking-wide">
            Challenge the streets
          </p>
        </div>

        <div className="bg-slate-900 border-2 border-[#CEFF00] rounded-lg p-6 shadow-lg shadow-[#CEFF00]/20">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 rounded font-bold uppercase text-sm transition-colors ${
                !isSignUp
                  ? 'bg-[#CEFF00] text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 rounded font-bold uppercase text-sm transition-colors ${
                isSignUp
                  ? 'bg-[#CEFF00] text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-slate-300 text-sm font-bold mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded text-white focus:border-[#CEFF00] focus:outline-none"
                  placeholder="runner123"
                  required={isSignUp}
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-sm font-bold mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded text-white focus:border-[#CEFF00] focus:outline-none"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-bold mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded text-white focus:border-[#CEFF00] focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors disabled:bg-slate-700 disabled:text-slate-500 uppercase flex items-center justify-center gap-2"
            >
              {loading ? (
                'Processing...'
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {isSignUp && (
            <div className="mt-4 p-3 bg-[#CEFF00]/10 border border-[#CEFF00]/30 rounded text-[#CEFF00] text-xs text-center">
              New accounts start with €100.00 balance
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
