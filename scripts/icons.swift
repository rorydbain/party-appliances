import AppKit
import Foundation
let base = CommandLine.arguments[1]
for (name, letter) in [("Loop", "L"), ("Photobooth", "P")] {
    let image = NSImage(size: NSSize(width: 1024, height: 1024))
    image.lockFocus()
    let rect = NSRect(x: 52, y: 52, width: 920, height: 920)
    NSColor(calibratedRed: 0.14, green: 0.17, blue: 0.14, alpha: 1).setFill()
    NSBezierPath(roundedRect: rect, xRadius: 205, yRadius: 205).fill()
    let attributes: [NSAttributedString.Key: Any] = [.font: NSFont(name: "HelveticaNeue-Medium", size: 650) ?? NSFont.systemFont(ofSize: 650), .foregroundColor: NSColor(calibratedRed: 0.945, green: 0.94, blue: 0.91, alpha: 1)]
    (letter as NSString).draw(at: NSPoint(x: 210, y: 126), withAttributes: attributes)
    NSColor(calibratedRed: 0.85, green: 0.98, blue: 0.49, alpha: 1).setFill()
    NSBezierPath(ovalIn: NSRect(x: 680, y: 230, width: 115, height: 115)).fill()
    image.unlockFocus()
    let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: base + "/" + name + ".png"))
}
