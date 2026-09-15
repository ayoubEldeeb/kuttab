export const Toaster = () => null;

const toast = {
  success: (msg: string) => {
    alert('نجاح: ' + msg);
  },
  error: (msg: string) => {
    alert('خطأ: ' + msg);
  }
};

export default toast;
