import { useState, useCallback } from 'react'

export const useUploadPopup = () => {
  const [isVisible, setIsVisible] = useState(false)

  const showPopup = useCallback(() => {
    setIsVisible(true)
  }, [])

  const hidePopup = useCallback(() => {
    setIsVisible(false)
  }, [])

  const togglePopup = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  return {
    isVisible,
    showPopup,
    hidePopup,
    togglePopup
  }
} 