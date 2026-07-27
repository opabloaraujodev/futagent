import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 max-w-lg w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-300 font-mono uppercase tracking-wider">
                Ocorreu um Erro de Renderização
              </h3>
              <p className="text-xs text-rose-200/80 mt-1 font-mono">
                {this.state.error?.message || 'Falha ao processar dados de visualização.'}
              </p>
            </div>
            <button
              onClick={() => (this as any).setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
