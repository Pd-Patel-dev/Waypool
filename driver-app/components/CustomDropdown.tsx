import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native';

interface DropdownItem {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  items: DropdownItem[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  enabled?: boolean;
  error?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CustomDropdown({
  items,
  selectedValue,
  onValueChange,
  placeholder,
  enabled = true,
  error,
}: CustomDropdownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<View>(null);

  const selectedItem = items.find((item) => item.value === selectedValue);

  const handleOpen = (): void => {
    if (!enabled) return;

    containerRef.current?.measureInWindow((x, y, width, height) => {
      const menuHeight = Math.min(200, items.length * 44);
      let top = y + height;
      let left = x;

      // Ensure dropdown doesn't go below screen
      if (top + menuHeight > SCREEN_HEIGHT) {
        top = y - menuHeight; // Show above if not enough space below
      }

      // Ensure dropdown doesn't go beyond screen width
      if (left + width > SCREEN_WIDTH) {
        left = SCREEN_WIDTH - width - 20; // Add padding from screen edge
      }

      // Ensure dropdown doesn't go before screen start
      if (left < 20) {
        left = 20;
      }

      setDropdownPosition({
        top: Math.max(0, top),
        left,
        width: Math.min(width, SCREEN_WIDTH - 40),
      });
      setIsOpen(true);
    });
  };

  const handleSelect = (value: string): void => {
    onValueChange(value);
    setIsOpen(false);
  };

  const handleClose = (): void => {
    setIsOpen(false);
  };

  return (
    <View style={styles.container} ref={containerRef}>
      <TouchableOpacity
        style={[styles.dropdownButton, error && styles.dropdownButtonError, !enabled && styles.dropdownButtonDisabled]}
        onPress={handleOpen}
        disabled={!enabled}
        activeOpacity={0.8}
      >
        <Text style={[styles.dropdownButtonText, !selectedItem && styles.placeholderText]}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View
            style={[
              styles.dropdownMenu,
              dropdownPosition && {
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedValue === item.value && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSelect(item.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedValue === item.value && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dropdownButton: {
    height: 56,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownButtonError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  placeholderText: {
    color: '#666',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    maxHeight: 200,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    ...Platform.select({
      ios: {
        zIndex: 1000,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  dropdownItemSelected: {
    backgroundColor: '#2C2C2E',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

