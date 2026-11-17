import { Modal, type ModalProps } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Native modals have their own window, orientation, and safe-area measurements. */
export function AppModal({ children, ...props }: ModalProps) {
  return <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} {...props}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </Modal>;
}
