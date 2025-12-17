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
      "
      style={{
        maxWidth: '430px',
        margin: '0 auto',
        // 70px + iOS safe-area (home indicator)
        height: 'calc(70px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex justify-around items-center h-full px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex flex-col items-center justify-center
                transition-all
                select-none
                min-w-[64px]
                ${isActive
                  ? 'text-emerald-600'
                  : item.id === 'premium'
                    ? 'text-yellow-600'
                    : 'text-gray-400'}
              `}
              style={{
                // iOS'ta yazı baseline kaymasını azaltır
                lineHeight: 1,
              }}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span
                className="text-[11px] font-medium mt-1"
                style={{ lineHeight: 1 }}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
