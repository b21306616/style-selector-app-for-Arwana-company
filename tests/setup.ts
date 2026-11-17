// Supply native window measurements that Jest cannot receive from an actual device.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
