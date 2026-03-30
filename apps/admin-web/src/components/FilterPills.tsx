import React from 'react';

export type FilterPeriod = '7D' | '30D' | '6M';

interface FilterPillsProps {
  activeFilter: FilterPeriod;
  onFilterChange: (filter: FilterPeriod) => void;
}

export const FilterPills: React.FC<FilterPillsProps> = ({ activeFilter, onFilterChange }) => {
  const options: { label: string; value: FilterPeriod }[] = [
    { label: '7 Days', value: '7D' },
    { label: '30 Days', value: '30D' },
    { label: '6 Months', value: '6M' },
  ];

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`filter-pill ${activeFilter === opt.value ? 'active' : ''}`}
          onClick={() => onFilterChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
