// src/pages/Settings.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Header from '../components/Layout/Header';

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const prefersReducedMotion = useReducedMotion();
  const fadeUp = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-canvas">
      <Header />
      <div className="pt-6 px-4 sm:px-6 lg:px-8" style={{ paddingBottom: 'calc(2rem + var(--bottom-inset))' }}>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Back + page title */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="-ml-2 text-text-dark hover:bg-transparent"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-display font-bold text-xl text-text-dark">Settings</span>
          </div>

          {/* Closing your account (was "Danger Zone" on the Profile page) */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-4 h-4 text-action-danger" />
                  <p className="text-sm font-semibold text-action-danger">Closing your account</p>
                </div>
                <p className="text-sm text-text-muted-brown mb-4">
                  Account deletion is not available at this time.
                </p>
                <Button
                  variant="destructive"
                  disabled
                  className="w-full"
                >
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
