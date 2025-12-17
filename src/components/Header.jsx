import React from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header = ({ userData, setUserData }) => {
  if (!userData) return null;

  const handleLogout = () => {
    localStorage.clear();
    setUserData(null);
  };

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur-md"
      style={{
        // iPhone notch / status bar için güvenli alan
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-gray-500">Hoş geldin</p>
            <h1 className="truncate text-[20px] font-bold tracking-tight text-gray-900">
              {userData.username}
            </h1>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="shrink-0 rounded-full"
            aria-label="Çıkış yap"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
          </Button>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
