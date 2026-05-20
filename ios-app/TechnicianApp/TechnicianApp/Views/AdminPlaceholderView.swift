//
//  AdminPlaceholderView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct AdminPlaceholderView: View {
    let title: String
    let description: String
    
    init(title: String, description: String = "Esta funcionalidad estará disponible próximamente") {
        self.title = title
        self.description = description
    }
    
    var body: some View {
        VStack(spacing: 16) {
            Text(title)
                .font(.title2)
                .fontWeight(.bold)
            
            Text(description)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}










