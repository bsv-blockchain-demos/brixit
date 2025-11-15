import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);

  const { login, authError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const location = useLocation();
  const from = location.state?.from?.pathname || '/map';

  // Clear form error on input change
  const clearErrors = () => {
    setFormError('');
  };

  const sanitizeInput = (input: string): string => {
    // Remove control chars + common injection vectors
    return input.trim().replace(/[\u0000-\u001F\u007F<>`"'\\]/g, '');
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = sanitizeInput(e.target.value);
    setEmail(input);
    clearErrors();
  
    if (input && !isValidEmail(input)) {
      setFormError('Please enter a valid email address.');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't aggressively sanitize passwords — just trim them
    setPassword(e.target.value.trim());
    clearErrors();
  };

  const validateForm = (): boolean => {
    if (!email || !password) {
      setFormError('Please fill in all fields');
      return false;
    }
    if (!isValidEmail(email)) {
      setFormError('Please enter a valid email address');
      return false;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (attemptCount >= 5) {
      setFormError('Too many login attempts. Please wait before trying again.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setFormError('');

    const success = await login(email, password);

    if (success) {
      toast({
        title: "Welcome back!",
        description: "You've been successfully logged in.",
      });
      setAttemptCount(0);
      navigate(from, { replace: true });
    } else {
      setAttemptCount(prev => prev + 1);
      // Show authError from context if available, fallback to generic
      setFormError(authError || 'Invalid email or password. Please try again.');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center space-x-2 mb-6">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">BRIX</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold text-gray-900">
              Sign in to your account
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Error */}
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              {/* Email Input */}
              <div>
                <Label htmlFor="email">Email address</Label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    className="pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    className="pl-10 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-green-600 hover:text-green-500"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || attemptCount >= 5}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                New accounts can only be created by administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
