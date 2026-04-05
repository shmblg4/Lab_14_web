const STORAGE_KEY = 'resume_data_v1'
const AUTOSAVE_DELAY = 500

function createRipple(event) {
  const element = event.currentTarget
  const rect = element.getBoundingClientRect()
  const size = Math.min(Math.max(rect.width, rect.height) * 0.8, 200)
  const x = event.clientX - rect.left - size / 2
  const y = event.clientY - rect.top - size / 2

  const ripple = document.createElement('span')
  ripple.classList.add('ripple')
  ripple.style.width = `${size}px`
  ripple.style.height = `${size}px`
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`

  element.appendChild(ripple)

  ripple.addEventListener('animationend', () => {
    ripple.remove()
  })
}

function initRipple() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', createRipple)
  })

  document.querySelectorAll('.resume-section').forEach(section => {
    section.addEventListener('click', e => {
      if (e.target.getAttribute('contenteditable') === 'true') return
      createRipple(e)
    })
  })
}

function showToast(message, duration = 2500) {
  const old = document.querySelector('.toast')
  if (old) old.remove()

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('toast-out')
    toast.addEventListener('animationend', () => toast.remove())
  }, duration)
}

function applyFieldValue(el, value) {
  if (typeof value === 'object' && value !== null && value.__t === 'bar') {
    if (value.w) el.style.width = value.w
    if (value.h !== undefined) el.innerHTML = value.h
    return true
  }
  if (typeof value === 'string' && value) {
    el.innerHTML = value
    return true
  }
  return false
}

function saveToStorage() {
  const data = {}
  document.querySelectorAll('[data-field]').forEach(el => {
    const field = el.getAttribute('data-field')
    if (el.classList.contains('language-bar')) {
      data[field] = {
        __t: 'bar',
        h: el.innerHTML,
        w: el.style.width || ''
      }
    } else {
      data[field] = el.innerHTML
    }
  })

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn(e)
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false

    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return false

    let hasData = false
    for (const field in data) {
      const el = document.querySelector(`[data-field="${CSS.escape(field)}"]`)
      if (!el) continue
      if (applyFieldValue(el, data[field])) hasData = true
    }

    return hasData
  } catch (e) {
    console.warn(e)
    return false
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

let saveTimeout = null

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveToStorage()
  }, AUTOSAVE_DELAY)
}

function flushSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  saveToStorage()
}

function animateTextChange(element) {
  element.classList.remove('text-changed')
  void element.offsetWidth
  element.classList.add('text-changed')
}

function initEditable() {
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    let originalText = ''

    el.addEventListener('focus', () => {
      originalText = el.innerHTML
    })

    el.addEventListener('blur', () => {
      if (el.innerHTML !== originalText) {
        animateTextChange(el)
        scheduleSave()
      }
    })

    el.addEventListener('keyup', () => {
      if (el.innerHTML !== originalText) {
        scheduleSave()
      }
    })

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !el.closest('li')) {
        e.preventDefault()
        el.blur()
      }
    })

    el.addEventListener('paste', e => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (document.queryCommandSupported?.('insertText')) {
        document.execCommand('insertText', false, text)
      } else {
        const sel = window.getSelection()
        if (!sel?.rangeCount) return
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      scheduleSave()
    })

    el.addEventListener('click', createRipple)
  })
}

function downloadPDF() {
  const btnDownload = document.getElementById('btn-download')
  const btnText = btnDownload.querySelector('.btn-text')
  const originalText = btnText.textContent

  btnText.textContent = '⏳ Генерация PDF...'
  btnDownload.disabled = true

  flushSave()

  let done = false
  const restore = () => {
    if (done) return
    done = true
    window.removeEventListener('afterprint', restore)
    clearTimeout(fallbackTimer)
    btnText.textContent = originalText
    btnDownload.disabled = false
    showToast('✅ В диалоге печати выберите «Сохранить как PDF».')
  }

  window.addEventListener('afterprint', restore)
  const fallbackTimer = setTimeout(restore, 4000)

  requestAnimationFrame(() => {
    window.print()
  })
}

function resetResume() {
  if (!confirm('Вы уверены, что хотите сбросить все изменения?')) return

  clearStorage()
  window.location.reload()
}

document.addEventListener('DOMContentLoaded', () => {
  const hasSavedData = loadFromStorage()

  initRipple()
  initEditable()

  document.getElementById('btn-download').addEventListener('click', downloadPDF)
  document.getElementById('btn-reset').addEventListener('click', resetResume)

  window.addEventListener('beforeunload', flushSave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })
  window.addEventListener('beforeprint', flushSave)

  if (hasSavedData) {
    setTimeout(() => {
      showToast('📋 Предыдущие данные восстановлены')
    }, 800)
  }
})
