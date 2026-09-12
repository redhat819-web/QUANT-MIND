import { createContext, useContext, type ReactNode } from 'react'

export type DataSource = 'mock' | 'supabase'

const DataSourceContext = createContext<DataSource>('mock')

function resolveDataSource(): DataSource {
  const value = import.meta.env.VITE_DATA_SOURCE
  return value === 'supabase' ? 'supabase' : 'mock'
}

export function DataSourceProvider({ children }: { children: ReactNode }) {
  return (
    <DataSourceContext.Provider value={resolveDataSource()}>
      {children}
    </DataSourceContext.Provider>
  )
}

/** mock↔supabase 전환 스위치(research.md §4). 이번 단계는 항상 'mock'만 사용 */
export function useDataSource(): DataSource {
  return useContext(DataSourceContext)
}
