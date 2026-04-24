// frontend/src/pages/CapsulePage.tsx
import PageTransition from '@/components/ui/PageTransition'

export default function CapsulePage() {
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-display font-bold text-ink-primary">记忆胶囊</h1>
        <p className="text-ink-secondary mt-1">此处将展示你创建的所有记忆胶囊</p>
      </div>
    </PageTransition>
  )
}
