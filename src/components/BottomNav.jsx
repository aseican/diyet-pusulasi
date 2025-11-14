import React from 'react';
import { motion } from 'framer-motion';
import { Home, UtensilsCrossed, TrendingUp, User, DollarSign } from 'lucide-react'; // DollarSign (veya Medal) ikonunu ekledik

const BottomNav = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Ana Sayfa' },
    { id: 'meals', icon: UtensilsCrossed, label: 'Öğünler' },
    { id: 'premium', icon: DollarSign, label: 'Premium' }, // <-- YENİ PREMIUM SEKMESİ
    { id: 'progress', icon: TrendingUp, label: 'İlerleme' },
    { id: 'profile', icon: User, label: 'Profil' },
  ];
  
  // Navigasyon barı 5 elemanlı olduğu için, layout'u 5'e bölmek için 
  // 'justify-around' yerine 'grid grid-cols-5' kullanmak daha doğru olur.
  // Ancak mevcut kodu en az değiştirerek devam ediyoruz.

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg" style={{ maxWidth: '430px', margin: '0 auto' }}>
      <div className="flex justify-around items-center px-4 py-2"> {/* Bu kısmı değiştirmedik */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all ${
                isActive 
                  ? 'text-emerald-600' 
                  : item.id === 'premium' 
                    ? 'text-yellow-600' // Premium butonu için farklı renk (Opsiyonel)
                    : 'text-gray-400'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-600 rounded-full"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;