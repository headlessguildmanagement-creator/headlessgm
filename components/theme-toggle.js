'use client'

import { useEffect, useState } from 'react'

const options = ['light', 'dark', 'system']

function applyTheme(value) {
  const root = document.documentElement
  if (value === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.dataset.theme = dark ? 'dark' : 'light'
  } else {
    root.dataset.theme = value
  }
  root.dataset.themePreference = value
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('system')

  useEffect(() => {
    const saved = localStorage.getItem('hgm-theme') || 'system'
    setTheme(saved)
    applyTheme(saved)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if ((localStorage.getItem('hgm-theme') || 'system') === 'system') applyTheme('system')
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  function choose(value) {
    localStorage.setItem('hgm-theme', value)
    setTheme(value)
    applyTheme(value)
  }

  return (
    <div className="theme-switcher" aria-label="Appearance">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={theme === option ? 'theme-switcher__button is-active' : 'theme-switcher__button'}
          onClick={() => choose(option)}
          aria-pressed={theme === option}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  )
}
