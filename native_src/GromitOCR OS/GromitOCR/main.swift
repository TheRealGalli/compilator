import Foundation
import Vision
import PDFKit
import AppKit

// MARK: - Native Messaging Protocol
struct OCRRequest: Codable {
    let base64: String
}

struct OCRResponse: Codable {
    let text: String
    let success: Bool
    let error: String?
}

func readMessage() -> Data? {
    let stdin = FileHandle.standardInput
    let lengthData = stdin.readData(ofLength: 4)
    guard lengthData.count == 4 else { return nil }
    let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self) }
    return stdin.readData(ofLength: Int(length))
}

func sendMessage(text: String, success: Bool, error: String? = nil) {
    let response = OCRResponse(text: text, success: success, error: error)
    guard let jsonData = try? JSONEncoder().encode(response) else { return }
    let length = UInt32(jsonData.count)
    var lengthBuffer = length
    let lengthData = Data(bytes: &lengthBuffer, count: 4)
    FileHandle.standardOutput.write(lengthData)
    FileHandle.standardOutput.write(jsonData)
}

// MARK: - OCR Engine
func performOCR(on image: CGImage) -> String {
    let requestHandler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["it-IT", "en-US"]
    
    do {
        try requestHandler.perform([request])
        guard let observations = request.results else { return "" }
        let recognizedStrings = observations.compactMap { $0.topCandidates(1).first?.string }
        return recognizedStrings.joined(separator: "\n")
    } catch {
        return ""
    }
}

// MARK: - Self-Registration (Zero-Config)
func registerHost() {
    let fileManager = FileManager.default
    let home = FileManager.default.homeDirectoryForCurrentUser
    let hostsPath = home.appendingPathComponent("Library/Application Support/Google/Chrome/NativeMessagingHosts")
    let manifestURL = hostsPath.appendingPathComponent("com.gromit.ocr.json")
    
    // Get current binary path
    let binaryPath = Bundle.main.executablePath ?? CommandLine.arguments[0]
    
    let manifest: [String: Any] = [
        "name": "com.gromit.ocr",
        "description": "Gromit Native OCR Bridge",
        "path": binaryPath,
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://legiinepkdobifjhlolpojdgcioolacj/"
        ]
    ]
    
    do {
        try fileManager.createDirectory(at: hostsPath, withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted)
        try data.write(to: manifestURL)
        // Note: print on stdout might break Native Messaging if not careful,
        // but this only runs once at startup if launched as App.
    } catch {
        // Fallback or log
    }
}

// MARK: - App logic
class GromitBridgeApp: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Register Host
        registerHost()
        
        // 2. Setup Menu Bar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem?.button {
            if let imageURL = Bundle.main.url(forResource: "menu_bar_icon", withExtension: "png"),
               let image = NSImage(contentsOf: imageURL) {
                image.isTemplate = true // Ensures icon color adapts to light/dark mode
                button.image = image
            } else {
                button.title = "👁️"
            }
            button.toolTip = "Gromit OCR Bridge"
        }
        
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Gromit Bridge: Attivo", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Esci", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem?.menu = menu
        
        // 3. Launch Ollama if needed
        launchOllama()

        // 4. Start Native Messaging Loop in background
        DispatchQueue.global(qos: .userInitiated).async {
            self.runNativeMessagingLoop()
        }
    }

    func launchOllama() {
        let ollamaAppUrl = URL(fileURLWithPath: "/Applications/Ollama.app")
        let workspace = NSWorkspace.shared
        
        // Check if already running
        let isRunning = workspace.runningApplications.contains { app in
            app.bundleURL == ollamaAppUrl || app.localizedName == "Ollama"
        }
        
        if !isRunning {
            if #available(macOS 10.15, *) {
                let config = NSWorkspace.OpenConfiguration()
                config.activates = false // Don't steal focus
                config.hides = true      // Launch hidden (menu bar only)
                workspace.openApplication(at: ollamaAppUrl, configuration: config) { _, _ in }
            } else {
                // Fallback for older macOS
                _ = try? workspace.launchApplication(at: ollamaAppUrl, options: [.withoutActivation, .andHide], configuration: [:])
            }
        }
    }
    
    func runNativeMessagingLoop() {
        while let messageData = readMessage() {
            autoreleasepool {
                do {
                    let request = try JSONDecoder().decode(OCRRequest.self, from: messageData)
                    guard let data = Data(base64Encoded: request.base64) else {
                        sendMessage(text: "", success: false, error: "Invalid Base64")
                        return
                    }
                    
                    var fullText = ""
                    if let pdfDoc = PDFDocument(data: data) {
                        for i in 0..<pdfDoc.pageCount {
                            if let page = pdfDoc.page(at: i) {
                                let rect = page.bounds(for: .mediaBox)
                                // High res thumbnail for OCR
                                let pageImage = page.thumbnail(of: rect.size, for: .mediaBox)
                                if let cgImage = pageImage.cgImage(forProposedRect: nil, context: nil, hints: nil) {
                                    fullText += performOCR(on: cgImage) + "\n"
                                }
                            }
                        }
                    } else if let image = NSImage(data: data), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
                        fullText = performOCR(on: cgImage)
                    } else {
                        sendMessage(text: "", success: false, error: "Format not supported")
                        return
                    }
                    
                    sendMessage(text: fullText.trimmingCharacters(in: .whitespacesAndNewlines), success: true)
                } catch {
                    sendMessage(text: "", success: false, error: "Processing Error: \(error.localizedDescription)")
                }
            }
        }
    }
}

// MARK: - Main Bootstrap
let app = NSApplication.shared
let delegate = GromitBridgeApp()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
