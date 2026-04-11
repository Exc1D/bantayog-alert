import { Link, useLocation } from 'react-router-dom';
import {
  MapPin,
  List,
  AlertCircle,
  Bell,
  User
} from 'lucide-react';

const navItems = [
  { path: '/map', label: 'Map', icon: MapPin },
  { path: '/feed', label: 'Feed', icon: List },
  { path: '/report', label: 'Report', icon: AlertCircle, prominent: true },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
];

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if (item.prominent) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative -top-4 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-red to-red-600 text-white shadow-lg border-4 border-white"
              >
                <Icon size={28} />
                <span className="text-xs font-semibold mt-1">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-16 h-full ${
                isActive ? 'text-primary-blue' : 'text-gray-500'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
