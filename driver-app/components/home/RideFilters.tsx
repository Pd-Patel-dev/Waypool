import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface RideFiltersProps {
  filterStatus: 'all' | 'scheduled' | 'in-progress' | 'completed';
  sortBy: 'date' | 'distance' | 'earnings';
  showFilters: boolean;
  onFilterStatusChange: (status: 'all' | 'scheduled' | 'in-progress' | 'completed') => void;
  onSortByChange: (sort: 'date' | 'distance' | 'earnings') => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
}

export const RideFilters: React.FC<RideFiltersProps> = ({
  filterStatus,
  sortBy,
  showFilters,
  onFilterStatusChange,
  onSortByChange,
  onToggleFilters,
  onClearFilters,
}) => {
  const hasActiveFilters = filterStatus !== 'all' || sortBy !== 'date';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.toggle}
          onPress={onToggleFilters}
          activeOpacity={0.7}
        >
          <IconSymbol size={18} name="line.3.horizontal.decrease" color="#FFFFFF" />
          <Text style={styles.toggleText}>Filter & Sort</Text>
          <IconSymbol
            size={14}
            name={showFilters ? 'chevron.up' : 'chevron.down'}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClearFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterOptions}>
              {(['all', 'scheduled', 'in-progress', 'completed'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    filterStatus === status && styles.filterChipActive,
                  ]}
                  onPress={() => onFilterStatusChange(status)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterStatus === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status === 'all'
                      ? 'All'
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort Options */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort By</Text>
            <View style={styles.filterOptions}>
              {(['date', 'distance', 'earnings'] as const).map((sort) => (
                <TouchableOpacity
                  key={sort}
                  style={[
                    styles.filterChip,
                    sortBy === sort && styles.filterChipActive,
                  ]}
                  onPress={() => onSortByChange(sort)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sortBy === sort && styles.filterChipTextActive,
                    ]}
                  >
                    {sort === 'date' ? 'Date' : sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
  filtersContainer: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    gap: 16,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  filterChipActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.7,
  },
  filterChipTextActive: {
    color: '#000000',
    opacity: 1,
  },
});

