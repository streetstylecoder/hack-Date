# Generated by Django 4.1.5 on 2023-04-19 20:04

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hackathons', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='hackathon',
            name='image',
            field=models.ImageField(default='images/None/no-img.jpg', upload_to='images/'),
        ),
    ]
