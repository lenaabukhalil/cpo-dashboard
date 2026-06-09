import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from './ui/button'

export type ErrorBoundaryLabels = {
  title: string
  message: string
  retry: string
}

type ErrorBoundaryProps = {
  children: ReactNode
  labels: ErrorBoundaryLabels
}

type ErrorBoundaryState = {
  error: Error | null
}

/**
 * Catches render errors so a single component failure never white-screens the app.
 * Auth expiry is handled in the API client (redirect); this boundary is for unexpected render faults.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    const { labels } = this.props
    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center"
        role="alert"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold text-foreground">{labels.title}</h1>
          <p className="text-sm text-muted-foreground">{labels.message}</p>
        </div>
        <Button type="button" variant="outline" onClick={this.handleRetry}>
          {labels.retry}
        </Button>
      </div>
    )
  }
}
