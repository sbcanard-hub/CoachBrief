import { useEffect } from 'react'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { fr, type TranslationKey } from '../i18n/fr'
import { it } from '../i18n/it'
import { usePreferences, type Language } from '../preferences'

const catalogues = { fr, en, it, es }
const sourceText = new WeakMap<Text, string>()
const sourceAttributes = new WeakMap<Element, Map<string, string>>()
const attributes = ['aria-label', 'placeholder', 'title'] as const

function translated(value: string, language: Language) {
  if (language === 'fr' || !value.trim()) return value
  const catalogue = catalogues[language]
  const entries = (Object.keys(fr) as TranslationKey[])
    .filter((key) => fr[key] !== catalogue[key])
    .sort((a, b) => fr[b].length - fr[a].length)
  let result = value
  for (const key of entries) result = result.split(fr[key]).join(catalogue[key])
  return result
}

/**
 * Compatibility localiser for legacy views. New UI uses `t(key)` directly; this
 * layer also covers generated weather/tactical labels while those remain plain
 * strings. Original node values are retained separately, so changing language
 * never touches form values or persisted briefing data.
 */
export function LocalizedDocument() {
  const { language } = usePreferences()
  useEffect(() => {
    let applying = false
    const localize = (root: Node) => {
      applying = true
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text)
      while (walker.nextNode()) nodes.push(walker.currentNode as Text)
      nodes.forEach((node) => {
        const parent = node.parentElement
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName) || parent.closest('[contenteditable="true"], [data-i18n-skip]')) return
        if (!sourceText.has(node)) sourceText.set(node, node.data)
        node.data = translated(sourceText.get(node)!, language)
      })
      const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : []
      elements.forEach((element) => attributes.forEach((attribute) => {
        const current = element.getAttribute(attribute)
        if (current === null) return
        let sources = sourceAttributes.get(element)
        if (!sources) { sources = new Map(); sourceAttributes.set(element, sources) }
        if (!sources.has(attribute)) sources.set(attribute, current)
        element.setAttribute(attribute, translated(sources.get(attribute)!, language))
      }))
      applying = false
    }
    localize(document.body)
    const observer = new MutationObserver((mutations) => {
      if (applying) return
      mutations.forEach((mutation) => mutation.addedNodes.forEach(localize))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [language])
  return null
}
