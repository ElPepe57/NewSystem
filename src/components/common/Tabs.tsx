import React, { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';

// ============= Tipos =============

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  /** Lista de tabs */
  tabs: Tab[];
  /** Tab activo por ID */
  activeTab: string;
  /** Callback cuando cambia el tab */
  onChange: (tabId: string) => void;
  /** Variante visual */
  variant?: 'underline' | 'pills' | 'boxed';
  /** Tamano */
  size?: 'sm' | 'md' | 'lg';
  /** Ocupar todo el ancho disponible */
  fullWidth?: boolean;
  /** Clases adicionales */
  className?: string;
}

export interface TabPanelProps {
  /** ID del tab asociado */
  tabId: string;
  /** Contenido del panel */
  children: React.ReactNode;
  /** Clases adicionales */
  className?: string;
  /** Habilitar animación de transición */
  animate?: boolean;
}

export interface TabsContextType {
  activeTab: string;
}

// ============= Context =============

const TabsContext = createContext<TabsContextType | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabPanel debe usarse dentro de un TabsProvider');
  }
  return context;
};

// ============= Estilos =============

const variantStyles = {
  underline: {
    container: 'border-b border-gray-200',
    tab: {
      base: 'relative px-4 py-2 font-medium text-gray-500 hover:text-gray-700 transition-colors',
      active: 'text-primary-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary-600',
      disabled: 'text-gray-300 cursor-not-allowed hover:text-gray-300'
    }
  },
  pills: {
    container: 'bg-gray-100 p-1 rounded-lg inline-flex',
    tab: {
      base: 'px-4 py-2 font-medium text-gray-600 rounded-md transition-all',
      active: 'bg-white text-gray-900 shadow-sm',
      disabled: 'text-gray-400 cursor-not-allowed'
    }
  },
  boxed: {
    container: 'border border-gray-200 rounded-lg p-1 inline-flex gap-1',
    tab: {
      base: 'px-4 py-2 font-medium text-gray-600 rounded-md transition-all',
      active: 'bg-primary-50 text-primary-700 border border-primary-200',
      disabled: 'text-gray-400 cursor-not-allowed'
    }
  }
};

const sizeStyles = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

// ============= Componentes =============

/**
 * Componente de Tabs reutilizable
 *
 * @example
 * const [activeTab, setActiveTab] = useState('general');
 *
 * <Tabs
 *   tabs={[
 *     { id: 'general', label: 'General', icon: <Settings /> },
 *     { id: 'advanced', label: 'Avanzado', badge: 3 },
 *     { id: 'disabled', label: 'Deshabilitado', disabled: true }
 *   ]}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 *   variant="underline"
 * />
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  className = ''
}) => {
  const styles = variantStyles[variant];

  const handleClick = useCallback(
    (tab: Tab) => {
      if (!tab.disabled) {
        onChange(tab.id);
      }
    },
    [onChange]
  );

  return (
    <div
      className={`
        ${styles.container}
        ${fullWidth ? 'flex' : 'inline-flex'}
        ${className}
      `}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleClick(tab)}
            className={`
              ${styles.tab.base}
              ${isActive ? styles.tab.active : ''}
              ${isDisabled ? styles.tab.disabled : ''}
              ${sizeStyles[size]}
              ${fullWidth ? 'flex-1' : ''}
              flex items-center justify-center gap-2
            `}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`
                  px-1.5 py-0.5 rounded-full text-xs font-medium
                  ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}
                `}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Panel de contenido asociado a un tab
 *
 * @example
 * <TabsProvider activeTab={activeTab}>
 *   <TabPanel tabId="general">
 *     <GeneralSettings />
 *   </TabPanel>
 *   <TabPanel tabId="advanced">
 *     <AdvancedSettings />
 *   </TabPanel>
 * </TabsProvider>
 */
export const TabPanel: React.FC<TabPanelProps> = ({ tabId, children, className = '', animate = true }) => {
  const { activeTab } = useTabsContext();
  const [isVisible, setIsVisible] = useState(activeTab === tabId);
  const [isAnimating, setIsAnimating] = useState(false);
  const isActive = activeTab === tabId;

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      // Pequeño delay para permitir la animación de entrada
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Esperar a que termine la animación antes de ocultar
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, animate ? 150 : 0);
      return () => clearTimeout(timer);
    }
  }, [isActive, animate]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      tabIndex={0}
      className={`
        ${className}
        ${animate ? 'transition-all duration-150 ease-out' : ''}
        ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
      `}
    >
      {children}
    </div>
  );
};

/**
 * Provider para manejar el contexto de tabs
 */
export const TabsProvider: React.FC<{
  activeTab: string;
  children: React.ReactNode;
}> = ({ activeTab, children }) => {
  return (
    <TabsContext.Provider value={{ activeTab }}>
      {children}
    </TabsContext.Provider>
  );
};

/**
 * Hook para manejar estado de tabs
 */
export const useTabs = (initialTab: string) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const changeTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  return {
    activeTab,
    setActiveTab: changeTab,
    isActive: (tabId: string) => activeTab === tabId
  };
};

/**
 * Componente combinado de Tabs con contenido
 *
 * @example
 * <TabsWithContent
 *   tabs={[
 *     { id: 'tab1', label: 'Tab 1', content: <Content1 /> },
 *     { id: 'tab2', label: 'Tab 2', content: <Content2 /> }
 *   ]}
 *   defaultTab="tab1"
 * />
 */
export const TabsWithContent: React.FC<{
  tabs: Array<Tab & { content: React.ReactNode }>;
  defaultTab?: string;
  variant?: TabsProps['variant'];
  size?: TabsProps['size'];
  className?: string;
  contentClassName?: string;
  animate?: boolean;
}> = ({
  tabs,
  defaultTab,
  variant = 'underline',
  size = 'md',
  className = '',
  contentClassName = '',
  animate = true
}) => {
  const { activeTab, setActiveTab } = useTabs(defaultTab || tabs[0]?.id || '');
  const [isAnimating, setIsAnimating] = useState(true);
  const prevTabRef = useRef(activeTab);

  const tabsData = tabs.map(({ content, ...tab }) => tab);
  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      setIsAnimating(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  return (
    <div className={className}>
      <Tabs
        tabs={tabsData}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant={variant}
        size={size}
      />
      <div
        className={`
          mt-4 ${contentClassName}
          ${animate ? 'transition-all duration-150 ease-out' : ''}
          ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
        `}
      >
        {activeContent}
      </div>
    </div>
  );
};
