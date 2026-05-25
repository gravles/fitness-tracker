import UIKit
import Capacitor

/// Subclass of CAPBridgeViewController so we can configure the WKWebView
/// after Capacitor sets it up. The storyboard points to this class instead
/// of CAPBridgeViewController directly.
class ViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        // Enable native iOS swipe-back gesture (left-edge swipe = browser back)
        webView?.allowsBackForwardNavigationGestures = true
        // Prevent black flash while remote URL loads (matches app dark background #0d1b2a)
        let bg = UIColor(red: 13/255, green: 27/255, blue: 42/255, alpha: 1.0)
        view.backgroundColor = bg
        webView?.backgroundColor = bg
        webView?.isOpaque = false
        webView?.scrollView.backgroundColor = bg
        // Enable Safari Web Inspector on iOS 16.4+ (required even for debug builds)
        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
    }
}
