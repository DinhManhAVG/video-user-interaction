import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Typography, Alert, Button } from '@mui/material';
import process from 'process';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  // Dùng để cập nhật state, hiển thị UI thay thế khi có lỗi
  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: _, errorInfo: null };
  }

  // Dùng để log lỗi chi tiết
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo }); // Lưu errorInfo để hiển thị chi tiết nếu cần
  }

  public render() {
    if (this.state.hasError) {
      // Bạn có thể tùy chỉnh UI hiển thị lỗi ở đây
      return (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            Đã xảy ra lỗi trong quá trình hiển thị dữ liệu này.
          </Alert>
          {/* Tùy chọn: hiển thị chi tiết lỗi chỉ trong môi trường dev */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
             <Box sx={{ mt: 2, textAlign: 'left', p: 2, border: '1px dashed grey', backgroundColor: '#f9f9f9' }}>
                 <Typography variant="h6">Chi tiết lỗi:</Typography>
                 <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                     {this.state.error.message}
                 </Typography>
                  {this.state.errorInfo?.componentStack && (
                      <Typography variant="caption" component="pre" sx={{ overflowX: 'auto', mt: 1 }}>
                          {this.state.errorInfo.componentStack}
                      </Typography>
                  )}
             </Box>
          )}
          {/* Tùy chọn: nút reset */}
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => window.location.reload()}>
              Tải lại trang
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;