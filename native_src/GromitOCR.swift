import Foundation
import Vision
import PDFKit
import AppKit

/**
 * GromitOCR Native Assistant v1.0.0
 * Uses Apple Vision and PDFKit for high-accuracy OCR.
 * Supports: Native Messaging (Chrome)
 * OS: macOS (AppKit)
 */

struct OCRRequest: Codable {
    let base64: String
    let fileName: String?
}

struct OCRResponse: Codable {
    let text: String
    let success: Bool
    let error: String?
}

// --- HELPER: NATIVE MESSAGING PROTOCOL ---
func readMessage() -> Data? {
    var length: UInt32 = 0
    let readCount = fread(&length, 1, 4, stdin)
    if readCount < 4 { return nil }
    
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(length))
    defer { buffer.deallocate() }
    
    let bytesRead = fread(buffer, 1, Int(length), stdin)
    if bytesRead < Int(length) { return nil }
    
    return Data(bytes: buffer, count: Int(length))
}

func sendMessage(text: String, success: Bool, error: String? = nil) {
    let response = OCRResponse(text: text, success: success, error: error)
    if let jsonData = try? JSONEncoder().encode(response) {
        var length = UInt32(jsonData.count)
        fwrite(&length, 1, 4, stdout)
        jsonData.withUnsafeBytes { ptr in
            _ = fwrite(ptr.baseAddress, 1, jsonData.count, stdout)
        }
        fflush(stdout)
    }
}

// --- OCR CORE ---
func performOCR(on image: CGImage) -> String {
    let requestHandler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["it-IT", "en-US"]
    
    do {
        try requestHandler.perform([request])
        guard let observations = request.results else { return "" }
        
        let recognizedStrings = observations.compactMap { observation in
            observation.topCandidates(1).first?.string
        }
        return recognizedStrings.joined(separator: " ")
    } catch {
        return ""
    }
}

// --- MAIN LOOP ---
func main() {
    guard let messageData = readMessage() else { return }
    
    do {
        let request = try JSONDecoder().decode(OCRRequest.self, from: messageData)
        guard let data = Data(base64Encoded: request.base64) else {
            sendMessage(text: "", success: false, error: "Invalid Base64")
            return
        }
        
        var fullText = ""
        
        // Try PDF first
        if let pdfDoc = PDFDocument(data: data) {
            for i in 0..<pdfDoc.pageCount {
                guard let page = pdfDoc.page(at: i) else { continue }
                
                // Get page bounds
                let mediaBox = page.bounds(for: .mediaBox)
                let scale: CGFloat = 3.0 // 216 DPI if original was 72
                let width = Int(mediaBox.width * scale)
                let height = Int(mediaBox.height * scale)
                
                // Create Bitmap Context
                guard let context = CGContext(data: nil,
                                              width: width,
                                              height: height,
                                              bitsPerComponent: 8,
                                              bytesPerRow: 0,
                                              space: CGColorSpaceCreateDeviceRGB(),
                                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
                
                // Fill White Background
                context.setFillColor(NSColor.white.cgColor)
                context.fill(CGRect(x: 0, y: 0, width: width, height: height))
                
                // Scale and Draw
                context.scaleBy(x: scale, y: scale)
                page.draw(with: .mediaBox, to: context)
                
                if let cgImage = context.makeImage() {
                    let pageText = performOCR(on: cgImage)
                    fullText += pageText + "\n"
                }
            }
        } else {
            // Try as direct image
            if let image = NSImage(data: data), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
                fullText = performOCR(on: cgImage)
            } else {
                 sendMessage(text: "", success: false, error: "Unsupported file format or corrupt data")
                 return
            }
        }
        
        sendMessage(text: fullText.trimmingCharacters(in: .whitespacesAndNewlines), success: true)
        
    } catch {
        sendMessage(text: "", success: false, error: "Processing Error: \(error.localizedDescription)")
    }
}

// Run Main
main()

// Wait, I used UIGraphicsImageRenderer and UIColor which are iOS. 
// For macOS (which the user is on), I need AppKit (NSImage, NSColor, etc.)
// Let's rewrite the rendering block for macOS.
