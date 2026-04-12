import { createFileRoute } from '@tanstack/react-router'
import { PromptBuilderApp } from '../components/PromptBuilderApp'

export const Route = createFileRoute('/')({
  component: PromptBuilderApp,
})
