import React from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header = ({ userData, setUserData }) => {
  if (!userData) return null;

  const handleLogout = () => {
    // Kullanıcı verilerini sıfırla → onboarding'e döner
    localStorage.clear();
    setUserData(null);
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-gray-500">Hoş Geldin,</p>
            <h1 className="text-xl font-bold text-gray-800">{userData.username}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5 text-gray-600" />
          </Button>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;