import { useToastStore } from '../../store/toastStore';
import Toast from './Toast';

export default function ToastRegion({ inModal = false }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const modalDepth = useToastStore((state) => state.modalDepth);

  if (inModal ? modalDepth === 0 : modalDepth > 0) {
    return null;
  }

  return (
    <div className="toast-region">
      {toasts.map((entry) => (
        <Toast
          key={entry.id}
          type={entry.type}
          message={entry.message}
          onDismiss={() => dismiss(entry.id)}
        />
      ))}
    </div>
  );
}
