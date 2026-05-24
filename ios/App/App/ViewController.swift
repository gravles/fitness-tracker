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
    }
}
