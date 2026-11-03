import {Component, type ErrorInfo, type ReactNode} from 'react';
import {logError, reportError} from '../lib/diagnostics';
import {ErrorScreen} from './ui/ErrorScreen';

interface Props {
    children: ReactNode;
    /** Full-screen (app root) vs in-shell (inside a route, keeps the chrome). */
    fullscreen?: boolean;
}

interface State {
    error: Error | null;
}

/** Catches render errors anywhere below and shows the custom ErrorScreen instead
 *  of a blank app. Retry clears the error to re-render the subtree. */
export class ErrorBoundary extends Component<Props, State> {
    state: State = {error: null};

    static getDerivedStateFromError(error: Error): State {
        return {error};
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
        logError(`[ErrorBoundary] ${error.message}`);
        reportError('render', error, { componentStack: info.componentStack });
    }

    render() {
        if (this.state.error) {
            return (
                <ErrorScreen
                    error={this.state.error}
                    onRetry={this.reset}
                    fullscreen={this.props.fullscreen}
                />
            );
        }
        return this.props.children;
    }

    private reset = () => this.setState({error: null});
}
