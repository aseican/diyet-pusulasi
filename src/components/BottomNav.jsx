import React from 'react';
import { motion } from 'framer-motion';
import { Home, UtensilsCrossed, TrendingUp, User, DollarSign } from 'lucide-react';

const BottomNav = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Ana Sayfa' },
    { id: 'meals', icon: UtensilsCrossed, label: 'Öğünler' },
    { id: 'premium', icon: DollarSign, label: 'Premium' },
    { id: 'progress', icon: TrendingUp, label: 'İlerleme' },
    { id: 'profile', icon: User, label: 'Profil' },
  ];

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 
        bg-white border-t border-gray-200 
        z-50 shadow-lg
        h-[70px]                                   /* sabit ve güvenli yükseklik */
        pb-[env(safe-area-inset-bottom)]           /* Xiaomi & iOS safe-area */
      "
      style={{ maxWidth: '430px', margin: '0 auto' }}
    >
      <div className="flex justify-around items-center h-full px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex flex-col items-center gap-1
                transition-all
                ${isActive 
                  ? 'text-emerald-600'
                  : item.id === 'premium'
                    ? 'text-yellow-600'
                    : 'text-gray-400'}
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
