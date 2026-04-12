import React, { useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  mobileLabel?: string;
  icon?: LucideIcon;
  count?: number;
  emoji?: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement;
    if (activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const scrollLeft = btnRect.left - containerRect.left - (containerRect.width / 2) + (btnRect.width / 2) + container.scrollLeft;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [activeTab]);

  if (variant === 'pills') {
    return (
      <div className="relative">
        <div ref={scrollRef} className="flex gap-1 sm:space-x-2 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              data-active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 sm:space-x-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {tab.emoji && <span>{tab.emoji}</span>}
              {tab.icon && <tab.icon className="h-4 w-4 hidden sm:block" />}
              {tab.mobileLabel ? (<><span className="sm:hidden">{tab.mobileLabel}</span><span className="hidden sm:inline">{tab.label}</span></>) : (<span>{tab.label}</span>)}
              {tab.count !== undefined && (
                <span className={`ml-1 px-1.5 sm:px-2 py-0.5 text-xs font-medium rounded-full ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-200 relative">
      <nav ref={scrollRef} className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 sm:space-x-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            {tab.emoji && <span className="text-base">{tab.emoji}</span>}
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.mobileLabel ? (<><span className="sm:hidden">{tab.mobileLabel}</span><span className="hidden sm:inline">{tab.label}</span></>) : (<span>{tab.label}</span>)}
            {tab.count !== undefined && (
              <span className={`ml-1 px-1.5 sm:px-2 py-0.5 text-xs font-medium rounded-full ${activeTab === tab.id ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sm:hidden absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none" />
    </div>
  );
};
