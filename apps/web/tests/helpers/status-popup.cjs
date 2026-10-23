function statusPopupMock(React) {
  function StatusPopup({ tone = 'info', title, message, onRetry, retryLabel = 'Try again', action }) {
    return React.createElement('aside', { role: tone === 'error' ? 'alert' : 'status', 'data-status-popup': tone },
      title || null, message || null, action || null,
      onRetry ? React.createElement('button', { type: 'button', onClick: onRetry }, retryLabel) : null);
  }
  StatusPopup.__statusPopupMock = true;
  return { StatusPopup };
}
function withStatusPopups(vm) {
  return { ...vm, runInNewContext(source, context, ...options) {
    const originalRequire = context.require;
    let React;
    function requireWithFeedback(id) {
      if (id === 'react') {
        if (!React) {
          const original = originalRequire(id);
          React = { ...original, createElement(type, props, ...children) {
            return type?.__statusPopupMock
              ? type({ ...props, children })
              : original.createElement ? original.createElement(type, props, ...children) : { type, props: { ...props, children } };
          } };
        }
        return React;
      }
      if (id === '@/components/shared/StatusPopup') {
        try { const existing = originalRequire(id); if (existing?.StatusPopup) return existing; } catch {}
        return statusPopupMock(requireWithFeedback('react'));
      }
      if (id === 'react/jsx-runtime') {
        const original = originalRequire(id);
        return { ...original,
          jsx: (type, props, ...args) => type?.__statusPopupMock ? type(props) : original.jsx(type, props, ...args),
          jsxs: (type, props, ...args) => type?.__statusPopupMock ? type(props) : original.jsxs(type, props, ...args),
        };
      }
      return originalRequire(id);
    }
    return vm.runInNewContext(source, { ...context, ...(context.React ? { React: requireWithFeedback('react') } : {}), require: requireWithFeedback }, ...options);
  } };
}
module.exports = { statusPopupMock, withStatusPopups };
