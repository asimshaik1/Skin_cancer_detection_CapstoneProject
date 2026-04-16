import os
import numpy as np
import cv2
import tensorflow as tf
from flask import Flask, render_template, request, redirect, url_for
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.efficientnet import preprocess_input
import matplotlib.cm as cm

import sqlite3
import re
app = Flask(__name__)

UPLOAD_FOLDER = "static/uploads"
GRADCAM_FOLDER = "static/gradcam"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GRADCAM_FOLDER, exist_ok=True)


# ======================================================
#  SELECT MODELS HERE (CHANGE HERE ONLY)
# ======================================================

HAM_BINARY_MODEL_NAME = "densenet121"
HAM_MULTI_MODEL_NAME = "densenet121"

BCN_BINARY_MODEL_NAME = "densenet121"
BCN_MULTI_MODEL_NAME = "densenet121"


# ======================================================
# CLASS LABELS (MUST MATCH TRAINING ORDER)
# ======================================================

HAM_BINARY_CLASSES = ["Benign", "Malignant"]

HAM_MULTI_CLASSES = [
    "akiec",
    "bcc",
    "bkl",
    "df",
    "mel",
    "nv",
    "vasc"
]

BCN_BINARY_CLASSES = ["Benign", "Malignant"]

BCN_MULTI_CLASSES = [
    "actinic_keratosis",
    "basal_cell_carcinoma",
    "dermatofibroma",
    "melanoma",
    "melanoma_metastasis",
    "nevus",
    "other",
    "scar",
    "seborrheic_keratosis",
    "solar_lentigo",
    "squamous_cell_carcinoma",
    "vascular_lesion"
]


# ======================================================
# LOAD MODEL
# ======================================================
def load_model_from_path(dataset, category, model_name):
    path = f"models/{dataset}/{category}/{model_name}.h5"
    return load_model(path)


# ======================================================
# PREPROCESS
# ======================================================
def preprocess(img_path):
    img = image.load_img(img_path, target_size=(128, 128))
    img_array = image.img_to_array(img)
    img_array = preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)
    return img_array


# ======================================================
# GRADCAM
# ======================================================
def make_gradcam_heatmap(img_array, model, last_conv_layer_name):

    grad_model = tf.keras.models.Model(
        [model.inputs],
        [model.get_layer(last_conv_layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        conv_output, predictions = grad_model(img_array)
        pred_index = tf.argmax(predictions[0])
        class_channel = predictions[:, pred_index]

    grads = tape.gradient(class_channel, conv_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_output = conv_output[0]
    heatmap = conv_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    heatmap = np.maximum(heatmap, 0) / np.max(heatmap)
    return heatmap


def save_gradcam(img_path, heatmap, save_path):

    img = cv2.imread(img_path)
    heatmap = cv2.resize(heatmap, (img.shape[1], img.shape[0]))

    heatmap = np.uint8(255 * heatmap)
    jet = cm.get_cmap("jet")
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = jet_colors[heatmap]

    jet_heatmap = cv2.resize(jet_heatmap, (img.shape[1], img.shape[0]))
    jet_heatmap = np.uint8(255 * jet_heatmap)

    superimposed = jet_heatmap * 0.4 + img
    cv2.imwrite(save_path, superimposed)


# ======================================================
# HAM ROUTES
# ======================================================

@app.route("/predict_ham", methods=["POST"])
def result1():

    file = request.files["image"]
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    img_array = preprocess(file_path)

    # Binary
    binary_model = load_model_from_path("ham10000", "binary", HAM_BINARY_MODEL_NAME)
    binary_pred = binary_model.predict(img_array)
    binary_index = np.argmax(binary_pred)

    binary_label = HAM_BINARY_CLASSES[binary_index]
    binary_conf = float(np.max(binary_pred)) * 100

    # Multi (Always run)
    multi_model = load_model_from_path("ham10000", "multi", HAM_MULTI_MODEL_NAME)
    multi_pred = multi_model.predict(img_array)

    multi_index = np.argmax(multi_pred)
    multi_label = HAM_MULTI_CLASSES[multi_index]
    multi_conf = float(np.max(multi_pred)) * 100

    # GradCAM using multi model
    last_conv_layer = [l.name for l in multi_model.layers if "conv" in l.name][-1]
    heatmap = make_gradcam_heatmap(img_array, multi_model, last_conv_layer)

    grad_path = os.path.join(GRADCAM_FOLDER, file.filename)
    save_gradcam(file_path, heatmap, grad_path)

    return render_template(
        "result1.html",
        binary_label=binary_label,
        binary_conf=round(binary_conf, 2),
        multi_label=multi_label,
        multi_conf=round(multi_conf, 2),
        image=file.filename,
        gradcam=file.filename
    )


# ======================================================
# BCN ROUTES
# ======================================================

@app.route("/predict_bcn", methods=["POST"])
def result2():

    file = request.files["image"]
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    img_array = preprocess(file_path)

    # Binary
    binary_model = load_model_from_path("bcn20000", "binary", BCN_BINARY_MODEL_NAME)
    binary_pred = binary_model.predict(img_array)
    binary_index = np.argmax(binary_pred)

    binary_label = BCN_BINARY_CLASSES[binary_index]
    binary_conf = float(np.max(binary_pred)) * 100

    # Multi
    multi_model = load_model_from_path("bcn20000", "multi", BCN_MULTI_MODEL_NAME)
    multi_pred = multi_model.predict(img_array)

    multi_index = np.argmax(multi_pred)
    multi_label = BCN_MULTI_CLASSES[multi_index]
    multi_conf = float(np.max(multi_pred)) * 100

    last_conv_layer = [l.name for l in multi_model.layers if "conv" in l.name][-1]
    heatmap = make_gradcam_heatmap(img_array, multi_model, last_conv_layer)

    grad_path = os.path.join(GRADCAM_FOLDER, file.filename)
    save_gradcam(file_path, heatmap, grad_path)

    return render_template(
        "result2.html",
        binary_label=binary_label,
        binary_conf=round(binary_conf, 2),
        multi_label=multi_label,
        multi_conf=round(multi_conf, 2),
        image=file.filename,
        gradcam=file.filename
    )


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("signup.html")
    else:
        username = request.form.get('user','')
        name = request.form.get('name','')
        email = request.form.get('email','')
        number = request.form.get('mobile','')
        password = request.form.get('password','')

        # Server-side validation
        username_pattern = r'^.{6,}$'
        name_pattern = r'^[A-Za-z ]{3,}$'
        email_pattern = r'^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
        mobile_pattern = r'^[6-9][0-9]{9}$'
        password_pattern = r'^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$'

        if not re.match(username_pattern, username):
            return render_template("signup.html", message="Username must be at least 6 characters.")
        if not re.match(name_pattern, name):
            return render_template("signup.html", message="Full Name must be at least 3 letters, only letters and spaces allowed.")
        if not re.match(email_pattern, email):
            return render_template("signup.html", message="Enter a valid email address.")
        if not re.match(mobile_pattern, number):
            return render_template("signup.html", message="Mobile must start with 6-9 and be 10 digits.")
        if not re.match(password_pattern, password):
            return render_template("signup.html", message="Password must be at least 8 characters, with an uppercase letter, a number, and a lowercase letter.")

        con = sqlite3.connect('signup.db')
        cur = con.cursor()
        cur.execute("SELECT 1 FROM info WHERE user = ?", (username,))
        if cur.fetchone():
            con.close()
            return render_template("signup.html", message="Username already exists. Please choose another.")
        
        cur.execute("insert into `info` (`user`,`name`, `email`,`mobile`,`password`) VALUES (?, ?, ?, ?, ?)",(username,name,email,number,password))
        con.commit()
        con.close()
        return redirect(url_for('login'))

@app.route("/signin", methods=["GET", "POST"])
def signin():
    if request.method == "GET":
        return render_template("signin.html")
    else:
        mail1 = request.form.get('user','')
        password1 = request.form.get('password','')
        con = sqlite3.connect('signup.db')
        cur = con.cursor()
        cur.execute("select `user`, `password` from info where `user` = ? AND `password` = ?",(mail1,password1,))
        data = cur.fetchone()

        if data == None:
            return render_template("signin.html", message="Invalid username or password.")    

        elif mail1 == 'admin' and password1 == 'admin':
            return render_template("home.html")

        elif mail1 == str(data[0]) and password1 == str(data[1]):
            return render_template("home.html")
        else:
            return render_template("signin.html", message="Invalid username or password.")

@app.route('/')
def index():
	return render_template('index.html')

@app.route('/home')
def home():
	return render_template('home.html')

@app.route("/prediction")
def prediction():
    return render_template("prediction.html")


@app.route("/graphs")
def graphs():
    return render_template("graphs.html")


@app.route('/logon')
def logon():
	return render_template('signup.html')

@app.route('/login')
def login():
	return render_template('signin.html')


if __name__ == "__main__":
    app.run(debug=True)