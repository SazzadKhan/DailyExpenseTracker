import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Convert settings-modal to nav-page settings
content = content.replace('<div class="modal" id="settings-modal">', '<div class="nav-page" data-page="settings">')
content = content.replace('<div class="modal-content modal-large">', '<section class="analytics-group">', 1)
content = content.replace('<div class="modal-header">\n                <h3>⚙️ Settings</h3>\n                <button class="modal-close" id="settings-close">&times;</button>\n            </div>', '<div class="analytics-group-header">\n                <h2 class="section-title">\n                    <span class="title-icon">⚙️</span>\n                    Settings\n                </h2>\n            </div>', 1)

# The end of settings-modal has:
#             </div>
#         </div>
#     </div>
# Since we replaced modal-content with section, it should just be:
#             </div>
#         </section>
#     </div>
content = content.replace('                    </div>\n                </div>\n            </div>\n\n            <!-- Profile Page (Dummy for now) -->', '                    </div>\n                </section>\n            </div>\n\n            <!-- Profile Page (Dummy for now) -->')


# 2. Extract "Add" page and move it to modals
add_page_match = re.search(r'(<!-- Add Page.*?)(?=<!-- Dashboard Page)', content, re.DOTALL)
if add_page_match:
    add_page_str = add_page_match.group(1)
    
    # Remove it from current location
    content = content.replace(add_page_str, '')
    
    # Convert it to a modal
    add_modal_str = add_page_str.replace('<div class="nav-page" data-page="add">', '<div class="modal" id="add-modal">')
    add_modal_str = add_modal_str.replace('<section class="input-section">', '<div class="modal-content modal-large">')
    
    add_modal_str = re.sub(
        r'<h2 class="section-title">\s*<span class="title-icon">➕</span>\s*Add New Transaction\s*</h2>',
        '<div class="modal-header">\n                <h3>➕ Add New Transaction</h3>\n                <button class="modal-close" id="add-close">&times;</button>\n            </div>',
        add_modal_str
    )
    
    add_modal_str = add_modal_str.replace('</section>', '</div>')
    
    # Inject it before <!-- Edit Modal -->
    content = content.replace('<!-- Edit Modal -->', add_modal_str + '\n    <!-- Edit Modal -->')


# 3. Add a Floating Action Button (FAB) or a button in the Dashboard for opening the Add Modal
dashboard_header = '<div class="analytics-group-header">\n                            <h2 class="section-title">\n                                <span class="title-icon">📈</span>\n                                Daily Trend\n                            </h2>'

new_dashboard_header = '<div class="analytics-group-header" style="justify-content: space-between; align-items: center; width: 100%;">\n                            <div style="display: flex; gap: 15px; align-items: center;">\n                                <h2 class="section-title" style="margin: 0;">\n                                    <span class="title-icon">📈</span>\n                                    Daily Trend\n                                </h2>\n                                <button id="dashboard-add-btn" class="btn-add" style="padding: 6px 12px; font-size: 0.9rem; margin: 0;">➕ Log Entry</button>\n                            </div>'

content = content.replace(dashboard_header, new_dashboard_header)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

