// Manual mock for react-hot-toast (used by frontend tests that assert on toast.error/toast.success).
const error = jest.fn()
const success = jest.fn()
export default { error, success }
